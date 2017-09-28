const Web3 = require('web3');
const abi = require('human-standard-token-abi')
const BlueBirdQueue = require('bluebird-queue')

import { toDecimal } from './helpers'

const web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('https://mainnet.infura.io/XFvO1QzGbQlghhdzlts4'))

const TOKEN_CONTRACTS = require('../data/tokens');
const CONTRACT_ADDRESSES = require('../data/tokens-reversed');

export const getContractAddress = (symbol) => {
	const tokenMeta = TOKEN_CONTRACTS[symbol]
	return tokenMeta ? tokenMeta.address : null
}

export const getETHBalance = async (address, cb) => {
	return web3.eth.getBalance(address).then((balance)=>
		Promise.resolve(toDecimal(balance, 18))
	).catch((err)=>Promise.reject(err))
}

export const getTokenInfo = async(contractAddress, fields, meta) => {
	const contract = new web3.eth.Contract(abi, contractAddress)
	fields = fields || ['totalSupply', 'decimals', 'symbol']

	const queries = fields.map((field)=>{
		switch (field) {
			case 'balance':
				return contract.methods.balanceOf(meta.address).call()
			case 'symbol':
				return CONTRACT_ADDRESSES[contractAddress]
			case 'decimals':
				let symbol = CONTRACT_ADDRESSES[contractAddress]
				return symbol ? TOKEN_CONTRACTS[symbol].decimals : null;
			default:
				return contract.methods[field]().call()
		}
	})

	const info = {}

	return Promise.all(queries).then((res)=>{
		res.forEach((value, i)=>{
			info[fields[i]] = value
		})
		const { balance, decimals } = info
		if (balance && decimals) {
			info['formattedBalance'] = toDecimal(balance, decimals).toString(10)
		}
		return Promise.resolve(info)
	})
}

export const getTokenBalance = async(contractAddress, address) => {
	return getTokenInfo(
		contractAddress, 
		['decimals', 'balance', 'symbol'],
		{ address }
	).then((info)=>Promise.resolve(info['formattedBalance']))
}

export const getAllTokenBalances = async(address, includeZeroBalances = false) => {
	const balances = {}

	const queue = new BlueBirdQueue({
		concurrency: 10
	})
	// TODO: unfortunately, ethereum addresses have no direct reference to which contract
	// addresses (a.k.a. tokens) are associated with it. This means we have to search 
	// every single token to see if it has a balance 💩💩💩. Luckily, there should be
	// a way to optimize this by looking at all the transactions associated with the given
	// ethereum address and keep track of which contract addresses (tokens) were involved
	const queries = Object.keys(TOKEN_CONTRACTS).map((symbol)=>{
		return async ()=>{
			let balance = await getTokenBalance(getContractAddress(symbol), address)
			if (balance === "0" && !includeZeroBalances) {
				return
			}
			balances[symbol] = balance
		}
	})
	queue.add(queries)
	return queue.start().then(()=>Promise.resolve(balances))
}