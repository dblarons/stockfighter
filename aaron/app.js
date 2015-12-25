/* jshint esnext: true */

var http = require('https');
var creds = require('./exports.js');
var API = require('../api.js').API;

var goal = 99999 - 8755;
var price = 9510;
var quantity = 500;
var sellQuantity = 25;

// Buy in quantities of a size defined by the quantity constant while the
// asking price is at or below our goal price until i is 0. Wait if the asking
// price is too high or the askSize is too small.
function buyMore(i) {
  if (i < 0) {
    console.log('Error: Exceeded goal of ' + goal + ' by ' + Math.abs(i));
  }

  if (i === 0) {
    console.log('Finished!');
    return;
  }

  api.getQuote(creds.venueId, creds.stockId).then(res => {
    if (res.ask === undefined) {
      console.log('res.ask was undefined');
      return Promise.resolve({res: i});
    }

    if (res.askSize < quantity) {
      console.log('Only ' + res.askSize + ' shares left, but we wanted ' + quantity + '.');
      return Promise.resolve({res: i});
    }

    if (res.ask > price) {
      console.log('Price of ' + res.ask + ' is too high. Wanted a price of ' + price);
      return Promise.resolve({res: i});
    }

    // Price is below what we're looking for and stocks are available... Buy!
    var bidSize = quantity;
    if (bidSize > i) {
      // Only bid for as much as we need.
      bidSize = i;
    }

    console.log('Buying ' + bidSize + ' shares at ' + res.ask + ' when ' + res.askSize + ' are available.');
    return bid(creds.venueId, creds.stockId, res.ask, bidSize, 'limit')
    .then(ask(creds.venueId, creds.stockId, res.bid, sellQuantity, 'limit'))
    .then(ask(creds.venueId, creds.stockId, res.bid, sellQuantity, 'limit'))
    .then(ask(creds.venueId, creds.stockId, res.bid, sellQuantity, 'limit'));
  })
  .then(res => {
    setTimeout(function() {buyMore(i - res.totalFilled + sellQuantity * 3);}, 400);
  })
  .catch(err => {
    console.log('Error: ' + err);
  });
}

buyMore(goal);
