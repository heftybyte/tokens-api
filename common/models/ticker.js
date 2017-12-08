'use strict';

module.exports = function(Ticker) {
  Ticker.disableRemoteMethodByName('invoke')
};
