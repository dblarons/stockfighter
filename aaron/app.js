var http = require('https');
var creds = require('./exports.js');
var sleep = require('sleep');
var Promise = require('promise');

var goal = 100000;
var orderSize = 200;

var buyOptions = {
  host: creds.baseUrl,
  path: '/ob/api/venues/' + creds.venue + '/stocks/' + creds.stock + '/orders',
  method: 'POST',
  headers: {'X-Starfighter-Authorization': creds.apiToken}
};

// var getPriceOptions = {
//   host: creds.baseUrl,
//   path: '/ob/api/venues/' + creds.venue + '/stocks/' + creds.stock + '/quote',
//   headers: {'X-Starfighter-Authorization': creds.apiToken}
// };

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

function buyMore(i, quantity) {
  var order = {
    'account': creds.account,
    'venue': creds.venue,
    'symbol': creds.stock,
    'price': 25000,
    'qty': quantity,
    'direction': "buy",
    'orderType': "limit"
  };

  buy(buyOptions, order).then(function(res) {
    if (res.totalFilled < orderSize && filledToPresent <= goal - 200) {
      console.log("Odd, you didn't fill as many as you expected to.");
      return;
    }

    var filledToPresent = i + res.totalFilled;
    if (filledToPresent == goal) {
      // Finished!
      return;
    } else if (filledToPresent <= goal - 200) {
      // Keep buying 200.
      sleep.usleep(1000);
      buyMore(filledToPresent, orderSize);
    } else {
      // Only buy enough to get us to the limit.
      sleep.usleep(1000);
      buyMore(filledToPresent, goal - filledToPresent);
    }
  }).catch(function(err) {
    console.log('problem: ' + err);
  });
}

buyMore(0, orderSize);
