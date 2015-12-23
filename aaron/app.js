var http = require('https');
var creds = require('./exports.js');
var sleep = require('sleep');
var Promise = require('promise');

var goal = 99999;
var price = 7893;
var quantity = 50;

var buyOptions = {
  host: creds.baseUrl,
  path: '/ob/api/venues/' + creds.venue + '/stocks/' + creds.stock + '/orders',
  method: 'POST',
  headers: {'X-Starfighter-Authorization': creds.apiToken}
};

var marketOptions = {
  host: creds.baseUrl,
  path: '/ob/api/venues/' + creds.venue + '/stocks/' + creds.stock + '/quote',
  headers: {'X-Starfighter-Authorization': creds.apiToken}
};

// Return a promise for a buy command given options and an order.
var buy = function(options, order) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });

      response.on('end', function () {
        var data = JSON.parse(str);
        if (data.ok === false) {
          reject(data.error);
        }
        resolve(data); // resolve the promise with a JSON object of the data
      }); 
    });

    req.on('error', function(e) {
      reject(e.message); // hit an error; reject the promise and clean up
    }); 

    // This is the data we are posting; it needs to be a string or a buffer.
    req.write(JSON.stringify(order));
    req.end();
  });
};

// Return a promise for a buy command given options and an order.
var peek = function(options) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });

      response.on('end', function () {
        var data = JSON.parse(str);
        if (data.ok === false) {
          reject(data.error);
        }
        resolve(data); // resolve the promise with a JSON object of the data
      }); 
    });

    req.on('error', function(e) {
      reject(e.message); // hit an error; reject the promise and clean up
    }); 

    // This is the data we are posting; it needs to be a string or a buffer.
    req.end();
  });
};

// Buy in quantities of half the askSize while the asking price is at or below
// our goal price until i is 0. Wait if the asking price is too high or the
// askSize is too small.
function buyMore(i) {
  var buyOrder = {
    'account': creds.account,
    'venue': creds.venue,
    'symbol': creds.stock,
    'price': 0,
    'qty': 0,
    'direction': "buy",
    'orderType': "limit"
  };

  if (i < 0) {
    console.log('Error: Exceeded goal of ' + goal + ' by ' + Math.abs(i));
  }

  if (i === 0) {
    console.log('Finished!');
    return;
  }

  peek(marketOptions).then(function(res) { 
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
    buyOrder.price = res.ask;
    buyOrder.qty = bidSize;
    return buy(buyOptions, buyOrder);
  })
  .then(function(res) {
    setTimeout(function() {buyMore(i - res.totalFilled);}, 400);
  })
  .catch(function(err) {
    console.log('Error: ' + err);
  });
}

buyMore(goal);
