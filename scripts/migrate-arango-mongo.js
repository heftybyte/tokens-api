const fs = require('fs')
const fileName = process.argv[2]
const arangoAccounts = require('../data/arango-accounts.json')
// const arangoAccessTokens = require('../data/arango-access-tokens.json')
const { ObjectId } = require('mongodb')

// const arangoAccessTokensMap = {}
// arangoAccessTokens.forEach((a)=>arangoAccessTokensMap[a.userId]=a)

const idFields = ['_id']
const rmFields = ['_key', '_rev']
const mongoAccessTokens = []
const mongoAccounts = arangoAccounts.map(doc=>{
	const oldId = doc._id.replace('account/', '')
	// const accessToken = arangoAccessTokensMap[oldId]
	replaceFields(doc, idFields, rmFields)

	// if (accessToken) {
	// 	replaceFields(accessToken, [], rmFields)
	// 	accessToken._id = accessToken._id.replace('AccessToken/', '')
	// 	accessToken.userId = doc._id['$oid']
	// 	mongoAccessTokens.push(JSON.stringify(accessToken))
	// }
	return JSON.stringify(doc)
})

function replaceFields(doc, idFields, rmFields) {
	const id = new ObjectId()
	idFields.forEach(field=>doc[field]={"$oid":id})
	rmFields.forEach(field=>delete doc[field])
}

fs.writeFileSync(`${__dirname}/../data/mongo-accounts.json`, mongoAccounts.join('\n'))
// fs.writeFileSync(`${__dirname}/../data/mongo-access-tokens.json`, mongoAccessTokens.join('\n'))
