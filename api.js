/* jshint esnext: true */
/* jshint node: true */

"use strict";

var http = require('https');

class API {
  constructor(creds) {
    this.creds = creds;
  }

  // Return an http request wrapped in a Promise object.
  promisify(options, body) {
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
          resolve(data);
        }); 
      });

      req.on('error', function(e) {
        reject(e.message);
      }); 

      if (body !== undefined) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  // Check the health of the API.
  getApiHealth() {
    const path = `/ob/api/heartbeat`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  // Check the health of a venue.
  getVenueHealth(venueId) {
    const path = `/ob/api/venues/${venueId}/heartbeat`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  // List the stocks available for trading on a venue.
  getStockList(venueId) {
    const path = `/ob/api/venues/${venueId}/stocks`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  // Make a bid on a stock.
  bid(venueId, stockId, price, qty, orderType) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/orders`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'POST',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };

    const direction = 'buy';
    const order = {
      'account': this.creds.account,
      'venue': venueId,
      'symbol': stockId,
      'price': price,
      'qty': qty,
      'direction': direction,
      'orderType': orderType
    };

    return this.promisify(options, order);
  }
}

module.exports = {
  API: API
};
