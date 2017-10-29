// Required by the cryptocompare library
require('babel-polyfill');
global.fetch = require('node-fetch');

const abi = require('human-standard-token-abi');
const BlueBirdQueue = require('bluebird-queue');
const cc = require('cryptocompare');
const coinmarketcap = require('coinmarketcap');

import web3 from './web3';
import { toDecimal } from './helpers';
import { COIN_MARKETCAP, CRYPTO_COMPARE, getPrice } from './price'

web3.setProvider(new web3.providers.HttpProvider('http://138.197.104.147:8545'));

const TOKEN_CONTRACTS = require('../data/tokens');
const CONTRACT_ADDRESSES = require('../data/tokens-reversed');

export const getContractAddress = (symbol) => {
  const tokenMeta = TOKEN_CONTRACTS[symbol];
  return tokenMeta ? tokenMeta.address : null;
};

export const getPriceForSymbol = async (fsym, tsym) => {
  // TODO:: read config to determine COIN_MARKETCAP or CRYPTO_COMPARE
  return await getPrice(fsym, tsym, COIN_MARKETCAP)
}

export const getETHBalance = async(address, cb) => {
  return web3.eth.getBalance(address).then((balance) =>
    Promise.resolve(toDecimal(balance, 18))
  ).catch((err) => Promise.reject(err));
};

export const getTokenInfo = async(contractAddress, fields, meta) => {
  const contract = new web3.eth.Contract(abi, contractAddress);
  fields = fields || ['totalSupply', 'decimals', 'symbol'];

  const queries = fields.map((field) => {
    switch (field) {
      case 'balance':
        return contract.methods.balanceOf(meta.address).call();
      case 'symbol':
        return CONTRACT_ADDRESSES[contractAddress];
      case 'decimals':
        let symbol = CONTRACT_ADDRESSES[contractAddress];
        return symbol ? TOKEN_CONTRACTS[symbol].decimals : null;
      default:
        return contract.methods[field]().call();
    }
  });

  const info = {};

  return Promise.all(queries).then((res) => {
    res.forEach((value, i) => {
      info[fields[i]] = value;
    });
    const {
      balance,
      decimals,
    } = info;

    if (balance && decimals) {
      info['formattedBalance'] = toDecimal(balance, decimals).toString(10);
    }
    return Promise.resolve(info);
  });
};

export const getTokenBalance = async(contractAddress, address) => {
  return getTokenInfo(
    contractAddress, ['decimals', 'balance', 'symbol'], {
      address,
    }
  ).then((info) => Promise.resolve(info['formattedBalance']));
};

export const getAllTokenBalances = async(address, includeZeroBalances = false) => {
    const queue = new BlueBirdQueue({
      concurrency: 10,
    });
    const queries = Object.keys(TOKEN_CONTRACTS).map((symbol) => {
      return new Promise(async (resolve, reject)=> {
        const results = await Promise.all([
          getTokenBalance(getContractAddress(symbol), address),
          getPriceForSymbol(symbol, 'USD')
        ])
        
        const balance = parseInt(results[0])

        if (Number.isNaN(balance) || !(balance || includeZeroBalances)) {
          return resolve();
        }

        const { price, change, period } = results[1]
        resolve({
          symbol,
          balance,
          price,
          change,
          period,
        })
      })
    })
    queue.add(queries)
    return queue.start().then((balances)=>{
      return Promise.resolve(balances.filter((balance)=>balance))
    })
};