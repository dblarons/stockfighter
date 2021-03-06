/* jshint esnext: true */
/* jshint node: true */

"use strict";

var creds = require('./exports.js');
var API = require('../api.js');
var Immutable = require('immutable');
var GM = require('../gm.js');
var Maybe = require('monet').Maybe;
var PriorityQueue = require('js-priority-queue');
var readline = require('readline');

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
var buffer = 38;

// Highest number of shares you can be positioned with in either direction.
var positionLimit = 500;

// ID specific to the current level. Does not change.
const instanceId = creds.instances.level3;

// For writing to console.
var rl = readline.createInterface(process.stdin, process.stdout);

// Time to wait between marketMaking executions in ms.
var waitTime = 1000;

// The driver function that makes markets.
function marketMaker(world) {
  // Execute a series of functions that mutate the world state. Last call
  // should be to marketMaker to repeat the process. All functions passed to
  // .then() should take a single, world, parameter that contains goal,
  // network, and state. It should then return a world for the next handler.
  gameManagerUpdate(world)
    .then(getQuote)
    .then(updateOpenOrders)
    .then(deleteStaleOrders)
    .then(submitBid)
    .then(submitAsk)
    .then(logger)
    .then(wait)
    .then(marketMaker)
    .catch(err => {
      console.log(`Error caught in marketMaker: ${err}`);
    }); // repeat process
}

// Wait for a specified amount of time.
function wait(world) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(world);
    }, waitTime);
  });
}

// First time running through logging code.
var firstTime = true;

// Log out useful information about the world.
function logger(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];
  var daysRemaining = world.state.get('daysRemaining');
  var bid = world.state.get('bid');
  var ask = world.state.get('ask');
  var last = world.state.get('last');
  var cash = world.state.get('backOffice').get('cash');
  var position = world.state.get('backOffice').get('position');
  var nav = world.state.get('backOffice').get('nav');
  var iCash = world.inventory.cash / 100;
  var iPosition = world.inventory.position;
  var iNav = world.inventory.nav(world.state.get('last')) / 100;
  var delta = iPosition - position;

  if (firstTime) {
    firstTime = false;
  } else {
    var lines = -7 - world.logging.prevLength;
    readline.moveCursor(rl, 0, lines);
    readline.clearScreenDown(rl);
  }

  var messagesLen = world.logging.messages.length;
  var recentMessages = world.logging.messages.slice(messagesLen - 10);
  var messages = recentMessages.reduce((acc, msg) => {
    return acc + `${msg}\n    `;
  }, ``);

  // Keep track of last messages length for erasing the lines in the next
  // iteration.
  world.logging.prevLength = recentMessages.length;

  process.stdout.write(
    `\n          --------------- World ---------------
    IDS:         venue: ${venueId} | stock: ${stockId}
    DAYS LEFT:   ${daysRemaining}
    MARKET:      bid: ${bid} | ask: ${ask} | last: ${last}
    BACK OFFICE: cash: ${cash} | position: ${position} | nav: ${nav}
    INTERNAL:    cash: ${iCash} | position: ${iPosition} | nav: ${iNav} | delta: ${delta}
    ${messages}`
  );
  return Promise.resolve(world);
}

// Get an update from the back office, if one is available, and update the
// world state.
function gameManagerUpdate(world) {
  // Parse the 'flash' message in the GM hidden endpoint to get the cash,
  // position, and nav from the back office.
  var flashParser = function(msg) {
    var expr = /((-?\d+\.\d{2})|-?\d+)/g;
    var data = msg.match(expr);

    return Immutable.Map({
      cash: parseFloat(data[0]),
      position: parseFloat(data[1]),
      nav: parseFloat(data[2])
    });
  };

  return world.network.gm.getInstanceStatus(instanceId).then(res => {
    var daysRemaining = Maybe.fromNull(res)
      .bind(msg => Maybe.fromNull(msg.details))
      .map(d => {
        return d.endOfTheWorldDay - d.tradingDay;
      }).orSome(500);
    var backOffice = Maybe.fromNull(res)
      .bind(msg => Maybe.fromNull(msg.flash))
      .bind(flash => Maybe.fromNull(flash.info))
      .map(flashParser)
      .orSome(Immutable.Map({
        cash: 0,
        position: 0,
        nav: 0
      }));
    return {
      daysRemaining: daysRemaining,
      backOffice: backOffice
    };
  }).then(instanceUpdate => {
    // Update state once transaction is complete
    var nextState = world.state.merge({
      'backOffice': instanceUpdate.backOffice,
      'daysRemaining': instanceUpdate.daysRemaining
    });
    world.state = nextState;
    return world;
  }).catch(err => {
    console.log(`Error thrown in level3->gameManagerUpdate: ${err}`);
  });
}

// Get a quote for the stock we're market making and update our internal state
// with details from the exchange. Remember, this quote is _already_ out of
// date.
function getQuote(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];

  return world.network.api.getQuote(venueId, stockId).then(res => {
    var oldBid = world.state.get('bid');
    var oldAsk = world.state.get('ask');
    var oldLast = world.state.get('last');
    var oldAskSize = world.state.get('askSize');
    var oldBidDepth = world.state.get('bidDepth');
    var oldAskDepth = world.state.get('askDepth');
    var maybeRes = Maybe.Some(res);

    // Update new bid / ask prices if they are available.
    var nextState = world.state.merge({
      'bid': maybeRes.bind(r => Maybe.fromNull(r.bid)).orSome(oldBid),
      'ask': maybeRes.bind(r => Maybe.fromNull(r.ask)).orSome(oldAsk),
      'last': maybeRes.bind(r => Maybe.fromNull(r.last)).orSome(oldLast),
      'askSize': maybeRes.bind(r => Maybe.fromNull(r.askSize)).orSome(oldAskSize),
      'bidDepth': maybeRes.bind(r => Maybe.fromNull(r.bidDepth)).orSome(oldBidDepth),
      'askDepth': maybeRes.bind(r => Maybe.fromNull(r.askDepth)).orSome(oldAskDepth)
    });

    world.state = nextState;
    return world;
  }).catch(err => {
    console.log(`Error thrown in level3->getQuote: ${err}`);
  });
}

// If there are new fills available, update position and cash in the internal
// back office and add the fill to our ownedHeap.
function updateInventory(oldStatus, newStatus, world) {
  newStatus.fills.slice(oldStatus.fills.length).forEach(fill => {
    world.inventory.purchase(newStatus.direction, fill.qty, fill.price);
    world.inventory.ownedHeap.queue({
      price: fill.price,
      qty: fill.qty,
      id: newStatus.id
    });
  });
}

function insertNewInventory(newStatus, world) {
  newStatus.fills.forEach(fill => {
    world.inventory.purchase(newStatus.direction, fill.qty, fill.price);
    world.inventory.ownedHeap.queue({
      price: fill.price,
      qty: fill.qty,
      id: newStatus.id
    });
  });
}

// Update all open orders whose ids we have kept.
function updateOpenOrders(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];

  var update = function(orders) {
    return Promise.all(orders.map(order => {
      // Get the latest (already outdated...) data for our orders.
      return world.network.api.getOrderStatus(venueId, stockId, order.id).then(res => {
        updateInventory(order.status, res, world); // MUTATION: update internal inventory
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
      console.log(`Error thrown in level3->updateOpenOrders->update: ${err}`);
    });
  };

  var openBids = world.state.get('openBids'); // immutable
  var openAsks = world.state.get('openAsks'); // immutable

  return Promise.all([update(openBids), update(openAsks)]).then(updated => {
    // Update order statuses if they are available.
    var nextState = world.state.merge({
      'openBids': updated[0],
      'openAsks': updated[1]
    });
    world.state = nextState;
    return world;
  });
}

// Delete orders that have no chance of being filled. No need to update the
// openBids and openAsks after they are deleted because they are not used after
// this point and deletion orders cannot be confirmed anyways.
function deleteStaleOrders(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];

  var openBids = world.state.get('openBids'); // immutable
  var openAsks = world.state.get('openAsks'); // immutable

  var bid = world.state.get('bid');
  var ask = world.state.get('ask');

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
      return world.network.api.deleteOrder(venueId, stockId, order.id).then(res => {
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
      console.log(`Error thrown in level3->deleteStaleOrders: ${err}`);
  });
}

function submitBid(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];

  var openBids = world.state.get('openBids');
  var openAsks = world.state.get('openAsks');

  var potentialPosition = world.inventory.position + openBids.reduce((acc, x) => {
    return acc + x.status.qty;
  }, 0);

  if (potentialPosition >= positionLimit) {
    // Don't buy if we are already at or over capacity.
    return Promise.resolve(world);
  }

  var cheapestPrice = Maybe.fromNull(openAsks.min((a,b) => {
    return a.status.price < b.status.price;
  })).bind(cheapest => Maybe.fromNull(cheapest.status.price))
     .orSome(0);

  var quantity = world.state.get('askSize');
  var price = world.state.get('ask');

  if (openAsks.isEmpty() || cheapestPrice > price) {
    if (quantity + potentialPosition > positionLimit) {
      // Don't exceed position limit.
      quantity = positionLimit - potentialPosition;
    }

    if (quantity === 0) {
      return Promise.resolve(world);
    }

    world.logging.messages.push(`Buying ${quantity} shares at ${price}.`);
    return world.network.api.bid(venueId, stockId, price, quantity, 'limit').then(res => {
      insertNewInventory(res, world);
      var nextState = world.state.update('openBids', s => s.push({
        id: res.id,
        status: res
      }));
      world.state = nextState;
      return world;
    }).catch(err => {
      world.logging.messages.push(`Error caught in submitBid: ${err}`);
    });
  }

  world.logging.messages.push(`Price of ${price} is too high. Wanted a price less than ${cheapestPrice}.`);
  return Promise.resolve(world);
}

// Create ask requests for all quantities of owned stock as long as the price
// is less than the minimum market asking price and the max ask inventory is
// not exceeded. Execute all requests asynchronously.
function submitAsk(world) {
  var venueId = world.network.ids.venues[0];
  var stockId = world.network.ids.tickers[0];

  var price = world.state.get('ask');
  var bid = world.state.get('bid');
  var openAsks = world.state.get('openAsks');
  var ownedHeap = world.inventory.ownedHeap;
  var askDepth = world.state.get('askDepth');

  var askList = []; // hold all the asks we'll place

  var potentialPosition = world.inventory.position - openAsks.reduce((acc, x) => {
    return acc + x.status.qty;
  }, 0);

  while (ownedHeap.length > 0) {
    var cheapestOwned = ownedHeap.peek();
    var postPrice = cheapestOwned.price + buffer;
    var qty = cheapestOwned.qty;

    if (askDepth === 0) {
      // Should post a higher price if there are no other offers on the market.
      postPrice = Math.max(postPrice, bid + buffer);
    }

    if (price < postPrice && askDepth !== 0) {
      world.logging.messages.push('Market asking price is too low to sell these shares');
      break;
    }

    if (potentialPosition - cheapestOwned.qty < -positionLimit) {
      world.logging.messages.push('Our position is too far short to sell more shares');
      break; // don't purchase for bad prices or when exceeding position limit
    }

    // Sell as close to the current market ask price as possible.
    postPrice = Math.max(postPrice - 1, postPrice);

    ownedHeap.dequeue();

    world.logging.messages.push(`Selling ${qty} shares at ${postPrice}.`);
    var newAsk = world.network.api.ask(venueId, stockId, postPrice, qty, 'limit').then(res => {
      insertNewInventory(res, world);
      return {
        id: res.id,
        status: res
      };
    });
    askList.push(newAsk);
  }

  // Add the newly placed ask orders to the openAsks in state.
  return Promise.all(askList).then(newAskOrders => {
    var updatedOpenAsks = newAskOrders.reduce((acc, order) => {
      return acc.push(order);
    }, world.state.get('openAsks'));

    world.state = world.state.set('openAsks', updatedOpenAsks);
    return world;
  });
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
  }).catch(err => {
    console.log(`Error in initNetwork: ${err}`);
  });
}


// The initial, immutable, state for our market maker.
var initState = Immutable.Map({
  // Summary of holdings.
  backOffice: Immutable.Map({
    cash: 0,
    position: 0,
    nav: 0
  }),

  daysRemaining: 500,

  bid: 0, // bid price on the market as of last sync
  ask: 0, // ask price on the market as of last sync
  last: 0, // last sale price on the market

  askSize: 0, // ask size on the market as of last sync
  bidDepth: 0, // aggregate size of *all bids*
  askDepth: 0, // aggregate size of *all asks*

  // [{id: 1, status: {...}}, {...}]
  openBids: Immutable.List(), // open buy orders
  openAsks: Immutable.List(), // open sell orders
});

// A mutable data structure representing our back office inventory.
class Inventory {
  constructor() {
    this.cash = 0; // amount of cash spent or owned
    this.position = 0; // number of shares currently owned

    // MinHeap of all the stock in our inventory, prioritized by the purchase
    // price. There may be multiple orders at the same price.
    // PQ([{price: 5000, qty: 10, id: 123}])
    this.ownedHeap = new PriorityQueue({comparator: this.minHeap});
  }

  // a is first if a is less than b
  static minHeap(a, b) {
    return a.price - b.price;
  }

  // Use position, cash, and last sale price to calculate nav.
  nav(last) {
    return this.cash + this.position * last;
  }

  purchase(direction, qty, price) {
    // Update cash on hand.
    if (direction === 'buy') {
      this.position += qty;
      this.cash -= price * qty;
    } else {
      this.position -= qty;
      this.cash += price * qty;
    }
  }
}

// The amount of money we want to make for this level.
const goal = 1000000;

// Starting point for our application. First, restart the level and initialize
// a network object for this instance (gets all ids and initializes API and GM
// clients), then start making markets.
initNetwork(instanceId).then(network => {
  var world = {
    goal: goal,
    network: network,
    state: initState,
    inventory: new Inventory(),
    logging: {
      messages: [],
      prevLength: 0
    }
  };
  marketMaker(world);
});
