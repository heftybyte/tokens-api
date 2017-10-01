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
	getTokenInfo,
  getPriceForSymbol
} from './eth'

app.use(express.static('public'))
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
	const { address } = req.params
	const contractAddress = getContractAddress(address) || address
	const balances = await getAllTokenBalances(contractAddress)
	const totalValue = balances.reduce((acc, token)=>{
		return acc + (token.price * token.balance)
	}, 0)
	res.send({
		totalValue: totalValue,
		tokens: balances
	})
})

app.get('/token/:symbol', async (req, res)=>{
	const { symbol } = req.params
	const contractAddress = getContractAddress(symbol) || symbol
	const token = await getTokenInfo(contractAddress)
	res.send(token)
})

app.get('/token/:symbol/price', async (req, res)=>{
	const symbol = req.params.symbol.toUpperCase()
 	const price = await getPriceForSymbol(symbol, 'USD')
  	res.send({ symbol, price })
})

app.listen(APP_PORT, ()=>{
	console.log(`listening on ${APP_PORT}`)
})
