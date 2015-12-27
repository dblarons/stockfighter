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

  // Check the health of the API.
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
}

module.exports = GM;
