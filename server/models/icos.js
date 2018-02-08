'use strict';

import constants from "../../constants";

module.exports = function(ICOS) {

	ICOS.badgeCount = (lastViewed, cb) => {
		ICOS.count({
		  	"createdAt": { "gte": lastViewed }
		  }, (err, data) => {
		  if (err) cb(err, null)
		  cb(null, {count: data})
		})
	}

	ICOS.observe('before save', (ctx, next) => {
		if (ctx.instance) {
			ctx.instance.createdAt = new Date().getTime()
		}
		next()
	});

	ICOS.remoteMethod('badgeCount', {
	    description: 'Fetch the ICO\'s since last viewed',
	    http: {path: constants.ENDPOINT.ICO_BADGE, verb: 'get'},
	    accepts: [
	      {arg: 'lastViewed', type: 'number', required: true}
	    ],
	    returns: {arg: 'data', type: 'object'},
  	});
};
