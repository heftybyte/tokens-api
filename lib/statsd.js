const StatsD = require('node-statsd');
  
const client = new StatsD({
	'host': 'statsd.hostedgraphite.com',
	'port': 8125,
	'prefix': 'dccb31dd-efbd-4bad-ac2c-8903e3e3df4a'
});


export const measureMetric = async(metric_name, start) => {
	const elapsed = new Date().getTime() - start;
	client.timing(metric_name, elapsed);
	client.increment(metric_name);
};


