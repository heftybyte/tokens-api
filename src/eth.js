const Web3 = require('web3');
const abi = require('human-standard-token-abi')
const BlueBirdQueue = require('bluebird-queue')

import { toDecimal } from './helpers'

const web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('https://mainnet.infura.io/XFvO1QzGbQlghhdzlts4'))

const TOKEN_CONTRACTS = {
	OMG: '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07',
	TNT: '0x08f5a9235b08173b7569f83645d2c7fb55e8ccd8'
}

export const getContractAddress = (symbol) => {
	return TOKEN_CONTRACTS[symbol]
}

export const getETHBalance = async (address, cb) => {
	return web3.eth.getBalance(address).then((balance)=>
		Promise.resolve(toDecimal(balance, 18))
	).catch((err)=>Promise.reject(err))
}

export const getTokenInfo = async(contractAddress, fields, meta) => {
	const contract = new web3.eth.Contract(abi, contractAddress)
	fields = fields || ['totalSupply', 'decimals']

	const queries = fields.map((field)=>{
		if (field === 'balance') {
			return contract.methods.balanceOf(meta.address).call()
		}
		return contract.methods[field]().call()
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
		['decimals', 'balance'],
		{ address }
	).then((info)=>Promise.resolve(info['formattedBalance']))
}

export const getAllTokenBalances = async(address) => {
	const queue = new BlueBirdQueue({
		concurrency: 10
	})
	const queries = Object.keys(TOKEN_CONTRACTS).map((symbol)=>{
		return async ()=>(
			{[symbol]: await getTokenBalance(TOKEN_CONTRACTS[symbol], address)}
		)
	})
	queue.add(queries)
	return queue.start().then(Promise.resolve)
}