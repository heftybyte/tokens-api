const constants = require('../../constants')

module.exports = function(Feed) {
	Feed.getLatest = async(oldestSeenId, newestSeenId, cb) => {

		let err = null

		oldestSeenId = Number.isNaN(Number(oldestSeenId)) ? 0 : Number(oldestSeenId)
		newestSeenId = Number.isNaN(Number(newestSeenId)) ? 0 : Number(newestSeenId)

		console.log({oldestSeenId, newestSeenId})
		// the OR operator doesn't seem to work with loopback-connector-arangodb
		const feeds = await Promise.all([
			Feed.find({
				where: {
					id: { gt: newestSeenId }
				},
				order: 'id DESC',
				limit: 5
			}),
			Feed.find({
				where: {
					id: { lt: oldestSeenId }
				},
				order: 'id DESC',
				limit: 5
			})
		]).catch(e =>{err=e});

		if(err){
			cb(err, null)
			return
		}

		const recentFeed = feeds
			.reduce((acc, curr)=>acc.concat(curr), [])
			.splice(0, 10)

		cb(null, recentFeed);
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
		accepts: [
			{
				arg: 'oldestSeenId',
				type: 'number',
				http: {
					source : 'query'
				},
				description : "The id of the oldes seen feed item retrieved",
			},

			{
				arg: 'newestSeenId',
				type: 'number',
				http: {
					source : 'query'
				},
				description : "The id of the newest seen feed item retrieved",
			}
		],
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