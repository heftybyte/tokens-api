const fs = require('fs')
const axios = require('axios')
const cheerio = require('cheerio')
const TICKER_URL = 'https://api.coinmarketcap.com/v1/ticker/?limit=0'
const TOKENS = require('../data/tokens')

const BlueBirdQueue = require('bluebird-queue');
const queue = new BlueBirdQueue({concurrency: 3, delay: 10000});

const tr = require('tor-request')
tr.TorControlPort.password = 'giraffe'

const imageUrl = (url) => {
  return `https://files.coinmarketcap.com/static/img/coins/128x128/${url}.png`;
}

const getRedditAcct = (html) => {
  const redditPath = html.split('oScript.src = "https://www.reddit.com/r/')[1];
  return redditPath ? `https://www.reddit.com/r/${redditPath.split('.embed')[0]}` : null;
}

async function treq(url) {
	return new Promise((resolve, reject)=>{
		tr.newTorSession((err)=>{
			if (err) {
				console.log('unable to get new tor session', err)
				return
			}
			tr.request(url, function (err, res, body) {
			  if (!err && res.statusCode == 200) {
			  	resolve(body)
			  } else {
			  	console.log(res.statusCode)
			  	reject(err)
			  }
			});
		})
	})
}

const init = async (TOKENS) => {
	const response = await treq(TICKER_URL)
	const ticker = JSON.parse(response)//.filter(tick=>!TOKENS[tick.symbol])
	const queries = ticker.map(token=>scrape(token))
	queue.add(queries)

	const scrapedTokens = await queue.start()
	console.log('scrapedTokens', scrapedTokens.length)
	scrapedTokens.filter(s=>s).forEach(tokenData=>{
		const data = {
			...(TOKENS[tokenData.symbol] || {}),
			...tokenData
		}
		TOKENS[token.symbol] = data
	})
	debugger
	console.log('writing updated token.json')
	fs.writeFileSync('../data/tokens.json', JSON.stringify(TOKENS))
	console.log('complete')
}

const scrape = async(token) => {
	try {
		const response = await axios.get(`https://coinmarketcap.com/currencies/${token.id}`)
		const html = response.data
		const $ = cheerio.load(html)
		const href = $('a[href*="https://ethplorer.io/address/0x"]').attr('href')
		const address = href && href.match(/0x.*[a-zA-Z0-9]/)[0]
		if (!address) {
			return null
		}
		const website = $('.list-unstyled li span[title=Website] + a').prop('href');
		const twitter = $('.twitter-timeline').prop('href');
		const reddit = getRedditAcct(html);
		return {
			symbol: token.symbol,
			id: token.id,
			address,
			website,
			twitter,
			reddit
		}
	} catch (err) {
		console.log('error', token.id)
		return null
	}
}

init(TOKENS)