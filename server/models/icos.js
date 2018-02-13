'use strict';

import constants from "../../constants";

module.exports = function(ICOS) {

	ICOS.fetch = (cb) => {
		const currentDate = new Date().getTime();

		ICOS.find({where:{"endDate": {'gt': currentDate}}}, function(err, data){
			
			if(err) cb(err, null)

			const result = {
				'featured':[],
				'upcoming':[],
				'active':  []
			}

			data.forEach(function(item){
				if(item.featured){
					result.featured.push(item)
				} else {
					if(item.startDate > currentDate){
						result.upcoming.push(item)
					}

					if(item.startDate < currentDate){
						result.active.push(item)
					}
				}
			})

			cb(null, {data: result})
		})
	}

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

  	ICOS.remoteMethod('fetch', {
  		description: 'Fetch the ICO\'s',
  		http: {path: '/', verb: 'get'},
  		returns: {arg: 'data', type: 'object'},
  	});

};
