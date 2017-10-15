const app = require('../../server/server')

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
			path: 'feed/latest/:id',
			verb: 'get'
		},
		accepts: {
			arg: 'id',
			type: 'string',
			http: {
				source : 'path'
			},
			description : "The id of the last lastest feed retreived",
			required: false,
		},
		returns: {
			name: 'feed',
			type: 'object'
		},
		description : "Fetch user lastest feed",
	});
}