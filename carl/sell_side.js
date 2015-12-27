/* jshint esnext: true */

var creds = require('./exports.js');
var API = require('../api.js').API;
var Immutable = require('immutable');
var GM = require('../gm.js');
var Maybe = require('monet').Maybe;

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

// The driver function that makes markets.
function marketMaker(goal, network, state) {
  api.getQuote(creds.venueid,creds.stockid).then(res => {
      if (res.ask === undefined) {
        console.log('res.ask was undefined');
        return Promise.resolve({res: i});
      }

      if (null postHeap && (res.askSize + positions) < 1000) {
        console.log('Buying ' + res.askSize + ' shares at ' + res.ask + '.');
        return bid(creds.venueId, creds.stockId, res.ask, res.askSize, 'limit');
      }

      if (null postHeap && positions < 999) {
        console.log('Buying 1 share at ' + res.ask + '.');
        return bid(creds.venueId, creds.stockId, res.ask, 1, 'limit');
      }

      if (postHeap[0] <= res.ask) {
        console.log('Price of ' + res.ask + ' is too high. Wanted a price less than ' + postHeap[0]);
        return Promise.resolve({res: i});
      }
  })
  var gm = new GM(creds.apiToken);
  backOfficeUpdate(gm).then(res => {
    var nextState = state.set('backOffice', res);
    marketMaker(goal, network, nextState);
  });
}

// Get an update from the back office, if one is available.
function backOfficeUpdate(gm) {
  return gm.getInstanceStatus(instanceId).then(res => {
    return Maybe.fromNull(res)
      .bind(msg => Maybe.fromNull(msg.flash))
      .bind(flash => Maybe.fromNull(flash.info))
      .map(flashParser)
      .orSome({
        cash: 0,
        position: 0,
        nav: 0
      });
  }).catch(err => {
    console.log(err);
  });
}

// Parse the 'flash' message in the GM hidden endpoint to get the cash,
// position, and nav from the back office.
function flashParser(msg) {
  var expr = /((\d+\.\d{2})|\d+)/g;
  var data = msg.match(expr);

  return {
    cash: data[0],
    position: data[1],
    nav: data[2]
  };
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

  openBids: Immutable.List(), // open buy orders
  openAsks: Immutable.List(), // open sell orders
});

// The amount of money we want to make for this level.
const goal = 1000000;

// Starting point for our application. First, restart the level and initialize
// a network object for this instance (gets all ids and initializes API and GM
// clients), then start making markets.
initNetwork(instanceId).then(network => {
  marketMaker(goal, network, initState);
});
