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

	Feed.feedActivity = async(data, cb) => {
    const  { FeedActivity } =  Feed.app.models;
    // alternatively we can use findOrCreate if it should be unique;
    const feedActivity = await FeedActivity.create(data);
    return cb(null);
	}

	Feed.observe('before save', function updateTimestamp(ctx, next) {
		if (!ctx.isNewInstance) {
			ctx.data["updatedAt"] = Date.now();
		}
		next();
	});

	Feed.remoteMethod('getLatest', {
		http: {
			path: constants.ENDPOINT.FEED_REQUEST,
			verb: 'get'
		},
		accepts: {
			arg: 'timestamp',
			type: 'string',
			http: {
				source : 'query'
			},
			description : "The timestamp of the lastest feed item retrieved",
		},
		returns: {
			root: true,
			type: "feed"
		},
		description : "Fetch user lastest feed",
	});

	Feed.remoteMethod('feedActivity', {
		http: {
			path: constants.ENDPOINT.FEED_ACTIVITY,
			verb: 'post'
		},
		accepts: {
			arg: 'data',
			type: 'object',
			http: {
				source: 'body'
      },
      documented: false,
			description: 'New feed activity'
		},
		returns: {
			arg: 'status',
			type: 'boolean'
		},
		description: 'Save a new feed activity'
	});
}