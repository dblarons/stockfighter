/* jshint esnext: true */

var API = require('../api.js').API;
var creds = require('../aaron/exports.js');


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
  function apiHealthTest(api) {
    api.getApiHealth().then(res => {
      assertEqual(res.ok, true, 'getApiHealth');
    }).catch(error => failedRequest('getApiHealth', error));
  },

  function venueHealthTest(api, creds) {
    api.getVenueHealth(creds.venueId).then(res => {
      assertEqual(res.ok, true, 'getVenueHealth');
    }).catch(error => failedRequest('getVenueHealth', error));
  },

  function stockListTest(api, creds) {
    api.getStockList(creds.venueId).then(res => {
      assertEqual(res.symbols[0].symbol, creds.stockId, 'getStockList');
    }).catch(error => failedRequest('getStockList', error));
  }
];

function runTests() {
  var api = new API(creds);
  tests.map(test => test(api, creds));
}

runTests();
