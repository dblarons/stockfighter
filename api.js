/* jshint esnext: true */
/* jshint node: true */

"use strict";

/*
 * getApiHealth()
 * getVenueHealth(venueId)
 * getStockList(venueId)
 * getOrderbook(venueId, stockId)
 * bid(venueId, stockId, price, qty, orderType)
 * ask(venueId, stockId, price, qty, orderType)
 * getQuote(venueId, stockId)
 * getOrderStatus(venueId, stockId, orderId)
 * deleteOrder(venueId, stockId, orderId)
 * getAllOrders(venueId)
 * getAllOrdersForStock(venueId, stockId)
 */

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

  // Get the orderbook for a particular stock.
  getOrderbook(venueId, stockId) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  // Make a bid on a stock. Prefer to use bid() or ask().
  placeOrder(venueId, stockId, price, qty, orderType, direction) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/orders`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'POST',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };

    const order = {
      'account': this.creds.accountId,
      'venue': venueId,
      'symbol': stockId,
      'price': price,
      'qty': qty,
      'direction': direction,
      'orderType': orderType
    };

    return this.promisify(options, order);
  }

  // Make a bid on a stock.
  bid(venueId, stockId, price, qty, orderType) {
    return this.placeOrder(venueId, stockId, price, qty, orderType, 'buy');
  }

  // Offer to sell a stock.
  ask(venueId, stockId, price, qty, orderType) {
    return this.placeOrder(venueId, stockId, price, qty, orderType, 'sell');
  }

  // Get a quick look at the most recent trade information for a stock.
  getQuote(venueId, stockId) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/quote`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  getOrderStatus(venueId, stockId, orderId) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/orders/${orderId}`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  deleteOrder(venueId, stockId, orderId) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/orders/${orderId}`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'DELETE',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  getAllOrders(venueId) {
    const path = `/ob/api/venues/${venueId}/accounts/${this.creds.accountId}/orders`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }

  getAllOrdersForStock(venueId, stockId) {
    const path = `/ob/api/venues/${venueId}/accounts/${this.creds.accountId}/stocks/${stockId}/orders`;
    const options = {
      host: this.creds.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
    return this.promisify(options);
  }
}

module.exports = {
  API: API
};
