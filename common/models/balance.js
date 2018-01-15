'use strict';

module.exports = function(Balance) {
    Balance.disableRemoteMethodByName('invoke')
};
