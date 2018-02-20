const fs = require('fs')
const fileName = process.argv[2]
const arangoAccounts = require('../data/arango-accounts.json')
// const arangoAccessTokens = require('../data/arango-access-tokens.json')
const { ObjectId } = require('mongodb')

// const arangoAccessTokensMap = {}
// arangoAccessTokens.forEach((a)=>arangoAccessTokensMap[a.userId]=a)

const addresses = arangoAccounts.reduce((acc, doc)=>{
	return acc.concat(doc.addresses.map(a=>a.id))
}, [])


fs.writeFileSync(`${__dirname}/../data/balance-addresses.json`, JSON.stringify(addresses))
