const constants = require('../../constants')
const FeedActivity = require('./feed-activity');

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
		let err = null;
		const feedActivity = await FeedActivity.create(data).catch(e => err = e);
		if (err){
      console.log('An error is reported from Invite.findOne: %j', err)
      err = new Error(err.message);
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
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