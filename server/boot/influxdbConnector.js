// const Influx = require('influx');


// const influx = new Influx.InfluxDB({
//   host: process.env.INFLUXDB_HOST || 'localhost',
//   database: process.env.INFLUXDB_DB || 'tokens',
//   username: process.env.INFLUXDB_USERNAME || 'root',
//   password: process.env.INFLUXDB_PASSWORD || 'root',
//   schema: [
//     {
//       measurement: '',
//       fields: {},
//       tags: [
//         'host',
//       ],
//     },
//   ],
// });

// influx.ping(5000).then(hosts => {
//   hosts.forEach(host => {
//     if (host.online) {
//       console.log(`InfluxDB log => ${host.url.host} responded in ${host.rtt}ms running ${host.version})`);
//     } else {
//       console.log(`${host.url.host} is offline :(`);
//     }
//   });
// });

// export default influx;
