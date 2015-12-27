/* jshint esnext: true */

var API = require('../api.js').API;
var creds = require('./exports.js');

function assertEqual(actual, expected, name) {
  if (actual === expected) {
    console.log(`${name} passed`);
  } else {
    console.log(`${name} failed`);
  }
}

function failedRequest(name, error) {
  console.log(`${name} request failed with error: '${error}'`);
}

var tests = [
  function getApiHealthTest(api) {
    api.getApiHealth().then(res => {
      assertEqual(res.ok, true, 'getApiHealth');
    }).catch(error => failedRequest('getApiHealth', error));
  },

  function getVenueHealthTest(api, creds) {
    api.getVenueHealth(creds.venueId).then(res => {
      assertEqual(res.ok, true, 'getVenueHealth');
    }).catch(error => failedRequest('getVenueHealth', error));
  },

  function getStockListTest(api, creds) {
    api.getStockList(creds.venueId).then(res => {
      assertEqual(res.ok, true, 'getStockList');
    }).catch(error => failedRequest('getStockList', error));
  },

  function getOrderbookTest(api, creds) {
    api.getOrderbook(creds.venueId, creds.stockId).then(res => {
      assertEqual(res.ok, true, 'getOrderbook');
    }).catch(error => failedRequest('getStockList', error));
  },

  function bidTest(api, creds) {
    var price = 10000;
    var qty = 1;
    api.bid(creds.venueId, creds.stockId, price, qty, 'limit').then(res => {
      assertEqual(res.ok, true, 'bid');
    }).catch(error => failedRequest('bid', error));
  },

  function askTest(api, creds) {
    var price = 0;
    var qty = 1;
    api.ask(creds.venueId, creds.stockId, price, qty, 'limit').then(res => {
      assertEqual(res.ok, true, 'ask');
    }).catch(error => failedRequest('ask', error));
  },

  function getQuoteTest(api, creds) {
    api.getQuote(creds.venueId, creds.stockId).then(res => {
      assertEqual(res.ok, true, 'getQuote');
    }).catch(error => failedRequest('getQuote', error));
  },

  function getOrderStatusTest(api, creds) {
    var price = 10000;
    var qty = 1;
    api.bid(creds.venueId, creds.stockId, price, qty, 'limit').then(res => {
      api.getOrderStatus(creds.venueId, creds.stockId, res.id).then(res => {
        assertEqual(res.ok, true, 'getOrderStatus');
      }).catch(error => failedRequest('getOrderStatus', error));
    });
  },

  function deleteOrderTest(api, creds) {
    var price = 10000;
    var qty = 1;
    api.bid(creds.venueId, creds.stockId, price, qty, 'limit').then(res => {
      api.deleteOrder(creds.venueId, creds.stockId, res.id).then(res => {
        assertEqual(res.ok, true, 'deleteOrder');
      }).catch(error => failedRequest('deleteOrder', error));
    });
  },

  function getAllOrdersTest(api, creds) {
    api.getAllOrders(creds.venueId).then(res => {
      assertEqual(res.ok, true, 'getAllOrders');
    }).catch(error => failedRequest('getAllOrders', error));
  },

  function getAllOrdersForStockTest(api, creds) {
    api.getAllOrdersForStock(creds.venueId, creds.stockId).then(res => {
      assertEqual(res.ok, true, 'getAllOrdersForStock');
    }).catch(error => failedRequest('getAllOrdersForStock', error));
  },
];

function runTests() {
  var api = new API(creds, creds.accountId);
  tests.map(test => test(api, creds));
}

runTests();
