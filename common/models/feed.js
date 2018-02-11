const constants = require('../../constants');
const app = require('../../server/server');

module.exports = function(Feed) {
	const MAX_SLOTS = 5
	const MAX_AD_SLOTS = 1
	const MAX_NEWS_SLOTS = 4
	const MAX_USER_SLOTS = 4

	const WEEK_MILLISECONDS = 24*60*60*7*1000

	// key - slot index, 
	// 		key - type, value - weight
	const SLOT_DISTRIBUTION = {
		0: [
			{type: 'news', weight: 1},
			{type: 'user', weight: 1}
		],
		1: [
			{type: 'news', weight: 1},
			{type: 'user', weight: 1}
		],
		2: [
			{type: 'ad', weight: 1}
		],
		3: [
			{type: 'news', weight: 1},
			{type: 'user', weight: 1}
		],
		4: [
			{type: 'news', weight: 1},
			{type: 'user', weight: 1}
		]
	}

	if (Object.keys(SLOT_DISTRIBUTION).length !== MAX_SLOTS) {
		throw new Error("SLOT_DISTRIBUTION is incomplete")
	}

	// Get news and ad feeds
	async function queryFeeds(feedState={}) {
		const results = await Promise.all([
			Feed.find({
				where: {
					type: 'ARTICLE',
					id: { nin: feedState.news || [] },
				},
				order: 'id DESC',
				limit: MAX_NEWS_SLOTS
			}),
			Feed.find({
				where: {
					type: 'AD',
					id: { nin: feedState.ad || [] },
					expired: false
				},
				order: 'id ASC',
				limit: MAX_AD_SLOTS
			})
		])
		return {
			news: results[0].map(r=>r.toJSON()).reverse(), // keep consistent order (last item is newest)
			ad: results[1].map(r=>r.toJSON()).reverse() // latest for ads is oldest (first come first serve)
		}
	}

	// Select random item by weight
	function selectRandByWeight(distribution) {
		const totalWeights = distribution.reduce((acc, curr)=>acc+curr.weight, 0)
		let rand = Math.round(Math.random() * (totalWeights - 1)) + 1
		const selectedOutcome = distribution.find(outcome=>{
			rand -= outcome.weight
			return rand <= 0
		})
		return selectedOutcome
	}

	Feed.getLatest = async(userId, cb) => {
		let account, feeds
		try {
			account = await app.default.models.Account.findById(userId)
			feeds = await queryFeeds(account.feedState && account.feedState.toJSON())
		} catch(err) {
			cb(err, null)
			return
		}

		// Filter for unseen user feed items
		const userFeedStateMap = {};
		(account.feedState && account.feedState.user || [])
			.forEach(itemId=>userFeedStateMap[itemId]=true)
		feeds.user = account.feed
			.filter(item=>!userFeedStateMap[item.id])
			.slice(-MAX_USER_SLOTS)
	
		// Fill slots according to SLOT_DISTRIBUTION and available items
		const slotTypes = {}
		const inventory = { news: [], ad: [], user: [] }
		for (let i = 0; i < MAX_SLOTS; i++) {
			// Filter out outcomes where no feed items of the type are left
			const distribution = SLOT_DISTRIBUTION[i].filter(outcome=>feeds[outcome.type].length > 0)
			const selectedOutcome = selectRandByWeight(distribution)
			if (!selectedOutcome) {
				continue
			}
			// Assign slot to latest element of type
			slotTypes[i] = selectedOutcome.type
			inventory[selectedOutcome.type].push(feeds[selectedOutcome.type].pop())
		}
		// Determine order of slots
		const lastSlotIndex = account.feedState && account.feedState.slot !== undefined ? account.feedState.slot : MAX_SLOTS-1
		const latestFeed = new Array()
		for (let slotIndex = lastSlotIndex + 1, i = 0; i < MAX_SLOTS; i++, slotIndex++) {
			if (slotIndex >= MAX_SLOTS) {
				slotIndex = 0
			}
			const feedItem = slotTypes[slotIndex] && inventory[slotTypes[slotIndex]].shift()
			if (feedItem) {
				latestFeed.push(feedItem)
			}
		}	
		cb(null, latestFeed)
		return latestFeed
	}

	Feed.viewItem = async(userId, itemId, cb) => {
		let account, feedItem
		try {
			const results = await Promise.all([
				app.default.models.Account.findById(userId),
				app.default.models.Feed.findById(itemId)
			])
			account = results[0]
			feedItem = results[1]
		} catch (err) {
			cb(err, null)
			return
		}

		account.feedState = account.feedState || {}
		account.feedState.slot = account.feedState.slot !== undefined ?
			account.feedState.slot + 1 : 0
		if (account.feedState.slot > MAX_SLOTS) {
			account.feedState.slot = 0
		}
		const lastReset = new Date(account.feedState.lastReset)
		const now = new Date()
		if (now - lastReset >= WEEK_MILLISECONDS) {
			account.feedState = {
				news: [],
				ad: [],
				user: [],
				lastReset: now,
				slot: account.feedState.slot
			} 
		}
		let feedType
		switch(feedItem.type) {
			case 'ARTICLE':
				feedType = 'news'
				break;
			case 'AD':
				feedType = 'ad'
				break;
			case 'USER':
				feedType = 'user'
				break;
			default:
				throw new Error ('unknown feed type')
		}
		const seenIds = new Set(account.feedState[feedType] || [])
		if (seenIds.has(itemId)) {
			cb(null, true)
			return
		}
		seenIds.add(itemId)
		account.feedState[feedType] = Array.from(seenIds)
		try {
			await account.save()
		} catch(err) {
			cb(err, null)
			return
		}
		cb(null, true)
		return
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
			path: '/:userId/latest',
			verb: 'get'
		},
		accepts: [
			{
				arg: 'userId',
				type: 'string',
				http: {
					source : 'path'
				},
				description : "The id of the user",
			}
		],
		returns: {
			root: true,
			type: "feed"
		},
		description : "Fetch the user's lastest feed",
	});

	Feed.remoteMethod('viewItem', {
		http: {
			path: '/:userId/item/:itemId/view',
			verb: 'post'
		},
		accepts: [
			{
				arg: 'userId',
				type: 'string',
				http: {
					source: 'path'
				},
				description: 'The id of the user'
			},
			{
				arg: 'itemId',
				type: 'string',
				http: {
					source: 'path'
				},
				description: 'The id of the feed item'
			}
		],
		returns: {
			arg: 'success',
			type: 'boolean'
		},
		description: 'Save a new feed view'
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