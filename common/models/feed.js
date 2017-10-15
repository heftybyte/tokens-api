const constants = require('../../constants')

module.exports = function(Feed) {
	Feed.getLatest = async(id, cb) => {

		let query = {}
		let err = null

		if(id){
			const lastFeed = await Feed.findById(id).catch(e => {err=e});
			if(err){
				cb(err , null)
			}

			query = {where: {createdAt: {gt: feed.createdAt}}}
		}

		query = { ...query , order: 'createdAt DESC', limit: 10};

		const recentFeed = await Feed.find(query).catch(e =>{err=e});
		if(err){
			cb(err, null)
		}

		cb(null ,recentFeed);
	}

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