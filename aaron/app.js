var http = require('http');
var creds = require('./creds');

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
  path: '/venues/' + creds.venue + '/stocks/' + creds.stock + '/orders',
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
// This is the data we are posting, it needs to be a string or a buffer
req.write(JSON.stringify(order));
req.end();
