const StatsD = require('node-statsd');

const client = new StatsD({
  'host': process.env.STATSD_HOST || 'localhost',
  'port': process.env.STATSD_PORT || '8125',
  'prefix': process.env.STATSD_PREFIX || '',
});

export const measureMetric = async(metric_name, start) => {
  const elapsed = new Date().getTime() - start;
  client.timing(metric_name, elapsed);
  client.increment(metric_name);
};

