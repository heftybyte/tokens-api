const {clientLogger}  = require('../../lib/logger');
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

  app.use(router);
};
