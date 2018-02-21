import axios from 'axios'
import server from '../server/server';
import FeedData from '../data/news-feed';
import redisClient from '../server/boot/redisConnector';
redisClient.quit()

const inquirer = require('inquirer');
const { Feed } = server.models;

const cryptopanic = {
	fetch: async () => {
		try {
			const filter = process.argv[2] || 'important'
			const response = await axios.get(`https://cryptopanic.com/api/posts/?auth_token=bce6da6de24b7fa8aa9ead0b6494e631de42f09f&currencies=BTC,ETH&filter=${filter}&public=true`)
			return response.data.results
		} catch (e) {
			console.log(e)
			return null
		}
	}
}

const init = async () => {
	const feed = await cryptopanic.fetch()

	if (!feed.length) {
		console.log('no news available')
		process.exit()
	}
	console.log(feed)
	const items = feed.map((item) => {
		if (['twitter.com', 'reddit.com'].indexOf(item.source.domain) >= 0) {
			return null
		}
		const type = 'ARTICLE'
		const format = 'TEXT'
		const {
			title: body, source: { title }, id
		} = item;
		return {
			id,
			title,
			body,
			type,
			format,
			link: {
				target: 'web'
			}
		};
	}).filter(f=>f);

	console.log(`Found ${items.length} stories\n`)
	const askForSources = items.map((fm)=>({
		type: 'input',
		message: `\n${fm.title} - ${fm.body}\nsource:`,
		name: fm.id
	}))

	try {
		const sources = await inquirer.prompt(askForSources)
		const feedModels = items.map(item=>{
			if (!sources[item.id]) {
				return null
			}
			item.link.uri = sources[item.id]
			delete item['id']
			return item
		}).filter(i=>i)
		console.log(JSON.stringify(feedModels))
		const confirm = await inquirer.prompt({
			type: 'confirm',
			name: 'confirm',
			message: 'Save items?'
		})
		if (confirm.confirm) {
			console.log('saving')
		} else {
			console.log('abort')
			process.exit()
		}
		Feed.create(feedModels, async (err, models) => {
			console.log(err ? 'Feed seeding failed' : `Feed data seeded (${models.length})`)
			const queries = models.map((model)=>model.save())
			try {
				await Promise.all(queries)
				console.log('saved feed')
				process.exit()
			} catch(e) {
				console.log('error saving feed', e)
			}
		});
	} catch (err) {
		console.log(err)
		return
	}


}

init()
