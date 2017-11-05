const StatsD = require('node-statsd');
  
const client = new StatsD({
	'host': process.env.STATSD_HOST,
	'port': process.env.STATSD_PORT,
	'prefix': process.env.STATSD_PREFIX
});

export const measureMetric = async(metric_name, start) => {
	const elapsed = new Date().getTime() - start;
	client.timing(metric_name, elapsed);
	client.increment(metric_name);
};


