global.Promise = require('bluebird')

const express = require('express')
const bodyParser = require('body-parser')

const app = express()
const APP_PORT = 3020

import {
	getContractAddress,
	getETHBalance,
	getTokenBalance,
	getAllTokenBalances,
	getTokenInfo
} from './eth'

app.use(bodyParser.json())

app.get('/account/:address', async (req, res)=>{
	const { address } = req.params
	const balance = await getETHBalance(address)
	res.send(`${balance}\r\n`)
})

app.get('/account/:address/token/:symbol', async (req, res)=>{
	const { address, symbol } = req.params
	const contractAddress = getContractAddress(symbol) || symbol
	const balance = await getTokenBalance(contractAddress, address)
	res.send(`${balance}\r\n`)
})

app.get('/account/:address/tokens', async (req, res)=>{
	const { address, symbol } = req.params
	const contractAddress = getContractAddress(symbol) || symbol
	const balances = await getAllTokenBalances(address)
	res.send(balances)
})

app.get('/token/:symbol', async (req, res)=>{
	const { symbol } = req.params
	const contractAddress = getContractAddress(symbol) || symbol
	const token = await getTokenInfo(contractAddress)
	res.send(token)
})

app.listen(APP_PORT, ()=>{
	console.log(`listening on ${APP_PORT}`)
})
