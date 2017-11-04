  var StatsD = require('node-statsd'),
  
      client = new StatsD({
      	'host': 'statsd.hostedgraphite.com',
      	'port': 8125,
      	'prefix': 'dccb31dd-efbd-4bad-ac2c-8903e3e3df4a'
      });

 module.exports = client;