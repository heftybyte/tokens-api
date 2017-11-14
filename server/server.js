require('babel-polyfill');
require('dotenv').load();
import bodyParser from 'body-parser';
import loopback from 'loopback';
import boot from 'loopback-boot';

const app = loopback();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.start = () =>
    // start the web server
    app.listen(() => {
      app.emit('started');
      const baseUrl = app.get('url').replace(/\/$/, '');
      console.log('Web server listening at: %s', baseUrl);
      if (app.get('loopback-component-explorer')) {
        const explorerPath = app.get('loopback-component-explorer').mountPath;
        console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
      }
    });

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, (err) => {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});

export default app;
