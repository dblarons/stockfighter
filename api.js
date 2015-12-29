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
  constructor(creds, accountId) {
    this.creds = creds;
    this.accountId = accountId;
  }

  options(method, path) {
    return {
      host: this.creds.baseUrl,
      path: path,
      method: method,
      headers: {'X-Starfighter-Authorization': this.creds.apiToken}
    };
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
    return this.promisify(this.options('GET', path));
  }

  // Check the health of a venue.
  getVenueHealth(venueId) {
    const path = `/ob/api/venues/${venueId}/heartbeat`;
    return this.promisify(this.options('GET', path));
  }

  // List the stocks available for trading on a venue.
  getStockList(venueId) {
    const path = `/ob/api/venues/${venueId}/stocks`;
    return this.promisify(this.options('GET', path));
  }

  // Get the orderbook for a particular stock.
  getOrderbook(venueId, stockId) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}`;
    return this.promisify(this.options('GET', path));
  }

  // Make a bid on a stock. Prefer to use bid() or ask().
  placeOrder(venueId, stockId, price, qty, orderType, direction) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/orders`;
    const order = {
      'account': this.accountId,
      'venue': venueId,
      'symbol': stockId,
      'price': price,
      'qty': qty,
      'direction': direction,
      'orderType': orderType
    };

    return this.promisify(this.options('POST', path), order);
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
    return this.promisify(this.options('GET', path));
  }

  // Get a status for an existing order.
  getOrderStatus(venueId, stockId, orderId) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/orders/${orderId}`;
    return this.promisify(this.options('GET', path));
  }

  // Cancel an order.
  deleteOrder(venueId, stockId, orderId) {
    const path = `/ob/api/venues/${venueId}/stocks/${stockId}/orders/${orderId}`;
    return this.promisify(this.options('DELETE', path));
  }

  // Get statuses for all market orders on all stocks.
  getAllOrders(venueId) {
    const path = `/ob/api/venues/${venueId}/accounts/${this.accountId}/orders`;
    return this.promisify(this.options('GET', path));
  }

  // Get the statuses for all orders on a particular stock.
  getAllOrdersForStock(venueId, stockId) {
    const path = `/ob/api/venues/${venueId}/accounts/${this.accountId}/stocks/${stockId}/orders`;
    return this.promisify(this.options('GET', path));
  }
}

module.exports = API;
