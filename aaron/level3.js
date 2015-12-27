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

const instanceId = creds.instances.level3;

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

function flashParser(msg) {
  var expr = /((\d+\.\d{2})|\d+)/g;
  var data = msg.match(expr);

  return {
    cash: data[0],
    position: data[1],
    nav: data[2]
  };
}

function marketMaker(goal, network, state) {
  var gm = new GM(creds.apiToken);
  backOfficeUpdate(gm).then(res => {
    var nextState = state.set('backOffice', res);
    marketMaker(goal, network, nextState);
  });
}

var network = {
  gm: new GM(creds.apiToken),
  api: new API(creds)
};

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

marketMaker(100000, network, initState);
