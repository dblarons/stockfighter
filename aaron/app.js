var http = require('https');
var creds = require('./exports.js');
var sleep = require('sleep');

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

function buyMore(i, quantity) {
  var req = http.request(buyOptions, function(response) {
    var str = '';
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      var data = JSON.parse(str);
      var lastFilledSize = data.fills.reduce(function(prev, curr) {
        return prev + curr.quantity;
      }, 0);

      if (lastFilledSize < orderSize && filledToPresent <= 100000 - 200) {
        console.log("Odd, you didn't fill as many as you expected to.");
        return;
      }

      var filledToPresent = i + data.totalFilled;
      if (filledToPresent == 100000) {
        // Finished!
        return;
      } else if (filledToPresent <= 100000 - 200) {
        // Keep buying 200.
        sleep.usleep(1000);
        buyMore(filledToPresent, orderSize);
      } else {
        // Only buy enough to get us to the limit.
        sleep.usleep(1000);
        buyMore(filledToPresent, 100000 - filledToPresent);
      }
    }); 
  });

  req.on('error', function(e) {
    console.log('problem: ' + e.message);
  });

  var order = {
    'account': creds.account,
    'venue': creds.venue,
    'symbol': creds.stock,
    'price': 25000,
    'qty': orderSize,
    'direction': "buy",
    'orderType': "limit"
  };

  // This is the data we are posting, it needs to be a string or a buffer
  req.write(JSON.stringify(order));
  req.end();  
}

buyMore(0, orderSize);




