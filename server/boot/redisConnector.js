/* eslint-disable camelcase */

let redis = require('redis');

let client = redis.createClient({
  port: '6379',
  host: '127.0.0.1',
  retry_strategy(options) {
    console.log('redis retry <<<<<<', options.attempt);
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.log('redis refused <<<<<<');
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.log('redis timeout <<<<<');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      console.log('redis max attempts <<<<<');
      return;
    }
    return Math.min(options.attempt * 100, 3000);
  },
});

client.on('connect', () => {
	console.log('redis client connected');
})

module.exports = client;
