var http = require('https');
var creds = require('./exports.js');

var order = {
  'account': creds.account,
  'venue': creds.venue,
  'symbol': creds.stock,
  'price': 25000,
  'qty': 100,
  'direction': "buy",
  'orderType': "limit"
};

var options = {
  host: creds.baseUrl,
  path: '/ob/api/venues/' + creds.venue + '/stocks/' + creds.stock + '/orders',
  method: 'POST',
  headers: {'X-Starfighter-Authorization': creds.apiToken}
};

var callback = function(response) {
  var str = '';
  response.on('data', function (chunk) {
    str += chunk;
  });

  response.on('end', function () {
    console.log(str);
  });
};

var req = http.request(options, callback);

req.on('error', function(e) {
    console.log('problem: ' + e.message);
});

// This is the data we are posting, it needs to be a string or a buffer
req.write(JSON.stringify(order));
req.end();
