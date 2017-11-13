const Raven = require('raven');
const DSN = process.env.NODE_ENV === 'development' ?
  '' :
  'https://10fb043a2f99494e9ea0763a61d4dced:c56096a148a4444ba644eaf3109520a3@sentry.io/239117';

Raven.config(DSN).install();

module.exports = function () {
  return Raven.errorHandler();
}