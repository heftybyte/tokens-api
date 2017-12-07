require('babel-polyfill');
require('dotenv').load();

const https = require('https');
const http = require('http');
const sslConfig = require('./ssl-config');

import { healthCheck } from '../lib/statsd';

import bodyParser from 'body-parser';
import loopback from 'loopback';
import boot from 'loopback-boot';

const app = loopback();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// health check
setInterval(healthCheck, 1000);


app.start = function(httpOnly) {
  if (httpOnly === undefined) {
    httpOnly = process.env.NODE_ENV !== 'production' || process.env.PLATFORM != 'digitalocean';
  }
  var server = null;
  if (!httpOnly) {
    var options = {
      key: sslConfig.privateKey,
      cert: sslConfig.certificate,
    };
    server = https.createServer(options, app);
  } else {
    server = http.createServer(app);
  }
  server.listen(app.get('port'), function() {
    var baseUrl = (httpOnly ? 'http://' : 'https://') + app.get('host') + ':' + app.get('port');
    app.emit('started', baseUrl);
    console.log('LoopBack server listening @ %s%s', baseUrl, '/');
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
  return server;
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, (err) => {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});

export default app;
