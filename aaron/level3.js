/* jshint esnext: true */

var creds = require('./exports.js');
var API = require('../api.js');
var Immutable = require('immutable');
var GM = require('../gm.js');
var Maybe = require('monet').Maybe;
var PriorityQueue = require('js-priority-queue');

/*
 * Conditions for when to buy
 *  - Buy as long as:
 *    price < cheapestSellPrice && position + depth < 1000
 * Keep track of what has been bought
 *  - Put order Id's along with the current status in a data structure. Update
 *    it periodically and remove when the order is filled.
 *  - TODO: When to cancel and repost a buy order.
 * Conditions for when to sell
 *  - Use a MinHeap and constantly post the minimum element to the market.
 *  - After purchasing a stock, place into the MinHeap at a fixed price more
 *    than it was bought for.
 *  - TODO: When to cancel and repost a sell order.
 * Keep track of what has been posted to sell
 *  - Put order Id's along with the current status in a data structure. Update
 *    it periodically and remove when the order is filled.
 * Keep track of our position (inversely related to cash value)
 *  - When a stock is bought, add it to our position; when sold, subtract.
 * Keep track of our cash value (inversely related to position)
 *  - When a stock is sold, add to cash value; when bought, subtract.
 * Keep track of our net asset value (NAV)
 *  - Calculate difference between amount of cash spent and the current value
 *    of the stocks that are held.
 *  - Stop once net > 10000
 */

// Amount that a bid or ask price is allowed to deviate from the norm bid or
// ask before deletion.
var buffer = 50;

// The driver function that makes markets.
function marketMaker(world) {
  // Execute a series of functions that mutate the world state. Last call
  // should be to marketMaker to repeat the process. All functions passed to
  // .then() should take a single, world, parameter that contains goal,
  // network, and state. It should then return a world for the next handler.
  backOfficeUpdate(world)
    .then(getQuote)
    .then(updateOpenOrders)
    .then(deleteStaleOrders)
    .then(submitBid)
    .then(submitAsk)
    .then(marketMaker); // repeat process
}

// Get an update from the back office, if one is available, and update the
// world state.
function backOfficeUpdate(world) {
  // Parse the 'flash' message in the GM hidden endpoint to get the cash,
  // position, and nav from the back office.
  var flashParser = function(msg) {
    var expr = /((\d+\.\d{2})|\d+)/g;
    var data = msg.match(expr);

    return {
      cash: data[0],
      position: data[1],
      nav: data[2]
    };
  };

  return world.network.gm.getInstanceStatus(instanceId).then(res => {
    return Maybe.fromNull(res)
      .bind(msg => Maybe.fromNull(msg.flash))
      .bind(flash => Maybe.fromNull(flash.info))
      .map(flashParser)
      .orSome({
        cash: 0,
        position: 0,
        nav: 0
      });
  }).then(backOffice => {
    // Update state once transaction is complete
    var nextState = world.state.set('backOffice', backOffice);
    return {
      goal: world.goal,
      network: world.network,
      state: nextState
    };
  }).catch(err => {
    console.log("Error thrown in level3->backOfficeUpdate: " + err);
  });
}

// Get a quote for the stock we're market making and update our internal state
// with details from the exchange. Remember, this quote is _already_ out of
// date.
function getQuote(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];

  network.api.getQuote(venueId, stockId).then(res => {
    var oldBid = world.state.bid;
    var oldAsk = world.state.ask;
    var maybeRes = Maybe.Some(res);

    // Update new bid / ask prices if they are available.
    var nextState = world.state.merge({
      'bid': maybeRes.bind(r => Maybe.fromNull(r.bid)).orSome(oldBid),
      'ask': maybeRes.bind(r => Maybe.fromNull(r.ask)).orSome(oldAsk),
    });
    return {
      goal: world.goal,
      network: world.network,
      state: nextState
    };
  }).catch(err => {
    console.log("Error thrown in level3->getQuote: " + err);
  });
}

// Update all open orders whose ids we have kept.
function updateOpenOrders(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];

  var update = function(orders) {
    return Promise.all(orders.map(order => {
      // Get the latest (already outdated...) data for our orders.
      return getOrderStatus(venueId, stockId, order.id).then(res => {
        return {
          id: order.id,
          status: res
        };
      });
    })).then(updatedOrders => {
      // Remove orders that have been filled.
      return updatedOrders.reduce((acc, x) => {
        if (x.status.qty === 0) {
          return acc; // order is filled
        } else {
          return acc.push(x); // keep track of unfilled orders
        }
      }, Immutable.List()); 
    }).catch(err => {
      console.log("Error thrown in level3->updateOpenOrders->update: " + err);
    });
  };

  var openBids = world.state.openBids; // immutable
  var openAsks = world.state.openAsks; // immutable

  Promise.all([update(openBids), update(openAsks)]).then(updated => {
    // Update order statuses if they are available.
    var nextState = world.state.merge({
      'openBids': updated[0],
      'openAsks': updated[1],
    });

    return {
      goal: world.goal,
      network: world.network,
      state: nextState
    };
  });
}

// Delete orders that have no chance of being filled. No need to update the
// openBids and openAsks after they are deleted because they are not used after
// this point and deletion orders cannot be confirmed anyways.
function deleteStaleOrders(world) {
  var openBids = world.state.openBids; // immutable
  var openAsks = world.state.openAsks; // immutable

  var bid = world.state.bid;
  var ask = world.state.ask;

  var isStaleBid = function(bidOrder) {
    // Return true if the bid should be deleted.
    var currPrice = bidOrder.status.price;
    return currPrice < bid - buffer || currPrice > ask;
  };

  var isStaleAsk = function(askOrder) {
    // Return true if the ask should be deleted.
    var currPrice = askOrder.status.price;
    return currPrice > ask + buffer || currPrice < bid;
  };

  var staleBids = openBids.filter(isStaleBid);
  var staleAsks = openAsks.filter(isStaleAsk);

  var remove = function(orders) {
    return Promise.all(orders.map(order => {
      // Submit a delete request (that may or may not actually be filled).
      return deleteOrder(venueId, stockId, order.id).then(res => {
        return {
          id: order.id,
          status: res
        };
      });
    }));
  };

  return Promise.all([remove(staleBids), remove(staleAsks)]).then(res => {
    // Return an old, naive world, which has not been updated with the deleted
    // orders because it would be no use waiting to find out if those deletions
    // were acted upon or not.
    return world;
  }).catch(err => {
      console.log("Error thrown in level3->deleteStaleOrders: " + err);
  });
}

function submitBid(world) {
  return Promise.resolve(world);
}

function submitAsk(world) {
  return Promise.resolve(world);
}

// Create API clients for injection. API client depends on GM because GM gets
// the accountId. Network also holds ids specific to this level instance.
// Calling initNetwork RESTARTS a level, so it should only be called ONCE at
// program initialization.
function initNetwork(instanceId) {
  var gm = new GM(creds.apiToken);
  return gm.restart(instanceId).then(ids => {
    var api = new API(creds, ids.accountId);
    return {
      gm: gm,
      api: api,
      ids: ids
    };
  });
}

// ID specific to the current level. Does not change.
const instanceId = creds.instances.level3;

// The initial, immutable, state for our market maker.
var initState = Immutable.Map({
  // Summary of holdings.
  backOffice: Immutable.Map({
    cash: 0,
    position: 0,
    nav: 0
  }),

  bid: 0, // bid price on the market as of last sync
  ask: 0, // ask price on the market as of last sync

  openBids: Immutable.List(), // open buy orders
  openAsks: Immutable.List(), // open sell orders
});

// The amount of money we want to make for this level.
const goal = 1000000;

// Starting point for our application. First, restart the level and initialize
// a network object for this instance (gets all ids and initializes API and GM
// clients), then start making markets.
initNetwork(instanceId).then(network => {
  var world = {
    goal: goal,
    network: network,
    state: initState
  };
  marketMaker(world);
});
