const abi = require('human-standard-token-abi');
const BlueBirdQueue = require('bluebird-queue');
const cc = require('cryptocompare');
const coinmarketcap = require('coinmarketcap');
const _ = require('lodash');

import web3 from './web3';
import {toDecimal} from './helpers';
import {COIN_MARKETCAP, CRYPTO_COMPARE, getPrice, getAllPrices, defaultPriceData} from './price';

web3.setProvider(new web3.providers.HttpProvider('http://138.197.104.147:8545'));

export const TOKEN_CONTRACTS = require('../data/tokens');
export const TOKEN_IDS = require('../data/coins-by-id');
const CONTRACT_ADDRESSES = require('../data/tokens-reversed');

export const getContractAddress = (symbol) => {
  const tokenMeta = TOKEN_CONTRACTS[symbol];
  return tokenMeta ? tokenMeta.address : null;
};

export const getPriceForSymbol = (fsym, tsym) => {
	// TODO:: read config to determine COIN_MARKETCAP or CRYPTO_COMPARE
  return getPrice(fsym, tsym, COIN_MARKETCAP);
};

export const getETHBalance = async (address, cb) => {
  return web3.eth.getBalance(address).then((balance) =>
		Promise.resolve(toDecimal(balance, 18))
	).catch((err) => Promise.reject(err));
};

export const getTokenInfo = async (contractAddress, fields, meta) => {
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
  }).catch((e) => {
    console.log('getTokenInfo Error: contractAddress', contractAddress, e);
  });
};

export const getTokenBalance = async (contractAddress, address) => {
  let err;
  return getTokenInfo(
		contractAddress, ['decimals', 'balance', 'symbol'], {
  address,
}
	).then((info) => Promise.resolve(info['formattedBalance'])).catch(e => err = e);
  if (err) {
    console.log('getTokenBalance error:', contractAddress, address);
  }
};

export const getEthAddressBalance = async (address) => {
  return new Promise(async (resolve, reject) => {
    const addressBalance = await getETHBalance(address);
    resolve({
      addressBalance: addressBalance.toString(10),
    });
  });
};

export const getAllTokenBalances = async (address, includeZeroBalances = false) => {
  const queue = new BlueBirdQueue({
    concurrency: 10,
  });
  const queries = Object.keys(TOKEN_CONTRACTS).map((symbol) => {
    return new Promise(async (resolve, reject) => {
      const results = await Promise.all([
        getTokenBalance(getContractAddress(symbol), address),
        getPriceForSymbol(symbol, 'USD'),
      ]);

      const balance = Number(results[0]);
      const {price, change, period, supply} = results[1];

      if (Number.isNaN(balance) || (!balance && !includeZeroBalances)) {
        return resolve();
      }

      resolve({
        symbol,
        balance,
        price,
        change,
        period,
        supply
      });
    });
  });
  queue.add(queries);
  return queue.start().then((balances) => {
    return Promise.resolve(balances.filter((balance) => balance));
  });
};

export const getTokenPrices = async (tokens = []) => {
  return Promise.all(tokens.map((symbol) => {
    return getPriceForSymbol(symbol, 'USD');
  }));
};

export const getTokenData = async () => {
  let err = null;
  const prices = await Promise.all(
		Object.keys(TOKEN_CONTRACTS).map(symbol => getPrice(symbol, 'USD', COIN_MARKETCAP))
	);

  const tokens = {}
  prices.forEach(price => {
  	const symbol = price.symbol
  	tokens[symbol] = {
		  ...price,
		  ...TOKEN_CONTRACTS[symbol]
	  }
  })

  return {
    err,
    tokens,
  };
};

export const getTopNTokens = async (n) => {
  let {err, tokens} = await getTokenData();

  if (err) {
    console.log('getTopNTokens: error fetching prices', err);
    return Promise.resolve({}); // TODO: retry
  }
  const tokenData = Object.keys(tokens)
	  .map(symbol=>tokens[symbol])
		.slice(0, n)
		.sort((a, b) => Number(a.marketCap) < Number(b.marketCap) ? 1 : -1);

  return Promise.resolve(tokenData);
};

export const getTokensBySymbol = async (symbols) => {
  let {err, tokens} = await getTokenData();

  if (err) {
    console.log('getTopNTokens: error fetching prices', err);
    return Promise.resolve({}); // TODO: retry
  }

  let filteredTokens = symbols.map(symbol => tokens[symbol])
  return Promise.resolve(filteredTokens);
};

