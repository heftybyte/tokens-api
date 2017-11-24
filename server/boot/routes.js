const { clientLogger }  = require('../../lib/logger');
const { COIN_MARKETCAP, getAllPrices }  = require('../../lib/price');
const _ = require('lodash');

module.exports = app => {
  let router = app.loopback.Router();
  app.post('/api/client-logs', (req, res) => {
    const {message, level} = req.body;
    let allowedLevel = [
      'debug',
      'info',
      'notice',
      'warning',
      'err',
      'crit',
	    'alert',
	    'emerg',
    ];

    if (!_.includes(allowedLevel, level)) {
      return res.status(401).json({message: 'Invalid Level'});
    }

	  clientLogger(message, level);
    return res.status(200).json({message: 'Log complete'});
  });

  app.get('/fetch-prices', async (req, res)=>{
    try {
      await getAllPrices('USD', COIN_MARKETCAP)
      res.send(200)
    } catch(e) {
      console.log('fetch prices', e)
      res.send(400)
    }
  })

  app.use(router);
};
