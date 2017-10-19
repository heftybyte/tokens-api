const constants = require('../../constants')

module.exports = function(Feed) {
	Feed.getLatest = async(createdAt, cb) => {

		let query = {}
		let err = null

		if(createdAt){
			query = {where: {createdAt: {gt: createdAt}}}
		}
		
		query = { ...query , order: 'createdAt DESC', limit: 10};

		const recentFeed = await Feed.find(query).catch(e =>{err=e});
		if(err){
			cb(err, null)
			return
		}

		cb(null ,recentFeed);
	}

	Feed.observe('before save', function updateTimestamp(ctx, next) {
		if (ctx.isNewInstance) {
			ctx.instance.createdAt = Date.now();
		} else if (ctx.data) {
			ctx.data["updatedAt"] = Date.now();
		}
		next();
	});

	Feed.remoteMethod('getLatest', {
		http: {
			path: constants.ENDPOINT.FEED_REQUEST,
			verb: 'get'
		},
		accepts: [{
			required: false,
			arg: 'id',
			type: 'string',
			http: {
				source : 'path'
			},
			description : "The id of the last lastest feed retreived",
			optional: true
		}],
		returns: {
			root: true,
			type: "feed"
		},
		description : "Fetch user lastest feed",
	});
}