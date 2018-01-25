'use strict';

import uuidv4 from 'uuid/v4'

module.exports = function(ExchangeAccount) {

	ExchangeAccount.observe('before save', (ctx, next) => {
		if (ctx.instance && !ctx.instance.id) {
			ctx.instance.id = uuidv4()
		}
		next()
	})
};
