/* jshint esnext: true */
/* jshint node: true */

"use strict";

var http = require('https');

class GM {
  constructor(apiToken) {
    this.baseUrl = 'www.stockfighter.io';
    this.apiToken = apiToken;
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

  // Get a status of this instance, including a flash info message and details
  // about the current trading day and end of world day.
  getInstanceStatus(instanceId) {
    const path = `/gm/instances/${instanceId}`;
    const options = {
      host: this.baseUrl,
      path: path,
      method: 'GET',
      headers: {'X-Starfighter-Authorization': this.apiToken}
    };
    return this.promisify(options);
  } 

  // Get info about this instance, including the accountId, stockId, and
  // venueId.
  getInstanceInfo(instanceId) {
    const path = `/gm/instances/${instanceId}/resume`;
    const options = {
      host: this.baseUrl,
      path: path,
      method: 'POST',
      headers: {'X-Starfighter-Authorization': this.apiToken}
    };

    const body = {
    };

    return this.promisify(options, body);
  }

  // Get the ids for a given instanceId.
  getIds(instanceId) {
    return this.getInstanceInfo(instanceId).then(res => {
      return {
        accountId: res.account,
        tickers: res.tickers,
        venues: res.venues
      };
    });
  }
}

module.exports = GM;
