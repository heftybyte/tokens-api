const constants = require('../../constants');
import app from '../../server/server';

module.exports = function(Feed) {
	Feed.getLatest = async(oldestSeenId, newestSeenId, lastPersonalFeedId, cb) => {

		let err = null

		oldestSeenId = Number.isNaN(Number(oldestSeenId)) ? 0 : Number(oldestSeenId)
		newestSeenId = Number.isNaN(Number(newestSeenId)) ? 0 : Number(newestSeenId)
		lastPersonalFeedId = Number.isNaN(Number(lastPersonalFeedId)) ? 0 : Number(lastPersonalFeedId)
		
		// const currentUser = app.currentUser;
		// const personalFeed = currentUser.feed().filter(feedItem => feedItem.id > lastPersonalFeedId);
		// if (personalFeed.length) return cb(null, personalFeed).catch(e => { return cb(err, null); });

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
				description : "The id of the oldest seen feed item retrieved",
			},

			{
				arg: 'newestSeenId',
				type: 'number',
				http: {
					source : 'query'
				},
				description : "The id of the newest seen feed item retrieved",
			},
			{
				arg: 'lastPersonalFeedId',
				type: 'number',
				http:{
					source: 'query'
				},
				description: "The id of last retrieved personal feed item"
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