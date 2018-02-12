import uuidv4 from 'uuid/v4'
import {
  getAllTokenBalances,
  getTokenBalance,
  getContractAddress,
  getPriceForSymbol,
  getEthAddressBalance,
  getTopNTokens,
  getTokenPrices,
  getTokensBySymbol,
  TOKEN_CONTRACTS
} from '../../lib/eth.js';
import { all } from '../../lib/async-promise';
const app = require('../../server/server');
const _ = require('lodash')
const constants = require('../../constants/');
const TOP_N = 100
import { measureMetric } from '../../lib/statsd';

import web3 from '../../lib/web3'

const INVITE_ENABLED = false

const defaultPriceData = {
  price: 0,
  change: 0,
  marketCap: 0,
  volume24Hr: 0,
  period: '24h'
};

const mapPrice = (priceMap, symbol) => {
  const priceData = priceMap[symbol] && priceMap[symbol]['USD'] ?
    priceMap[symbol]['USD'] : defaultPriceData
  return {
    price: priceData.price,
    change: priceData.change_pct_24_hr,
    marketCap: priceData.market_cap,
    volume24Hr: priceData.volume_24_hr,
    period: '24h',
    supply: priceData.supply
  }
}

module.exports = function(Account) {

  Account.register = async (data, cb) => {

    //metric timing
    const start_time = new Date().getTime();

    let err = null, Invite = app.default.models.Invite;

    const invite = INVITE_ENABLED &&
      await Invite.findOne({where: {invite_code: data.code}}).catch(e=>err=e)

    if (err){

      // metrics
      measureMetric(constants.METRICS.register.failed, start_time);

      console.log('An error is reported from Invite.findOne: %j', err)
      err = new Error(err.message);
      err.status = 400;
      return cb(err);
    }

    if (!invite && INVITE_ENABLED) {

      // metrics
      measureMetric(constants.METRICS.register.invalid_code, start_time);

      err = new Error("You need a valid invitation code to register.\nTweet @tokens_express to get one.");
      err.statusCode = 400;
      return cb(err);
    } else if (!invite.claimed || !INVITE_ENABLED) {

      // metrics
      measureMetric(constants.METRICS.register.success, start_time);

      delete data.code
      const instance = await Account.create(data).catch(e=>err=e)
      if (err) {
        err = new Error(err.message);
        err.status = 400;
        return cb(err);
      }
      if (INVITE_ENABLED) {
        invite.claimed = true
        await invite.save().catch(e=>err=e)
        if (err) {
          console.log('unable to update claimed invite: %j', err)
        }
      }
      return cb(null, instance);
    } else {

      // metrics
      measureMetric(constants.METRICS.register.claimed, start_time);

      err = new Error("This invite has already been claimed.\nTweet @tokens_express to get a new one.");
      err.statusCode = 400;
      return cb(err);
    }
  };

  Account.prototype.addToWatchList = async function (data, cb) {
    const { symbol } = data

    let { err, token } = await getTokenBySymbol(symbol);
    if (err) {
      cb(err)
      return err
    }

    if(_.includes(this.watchList, token.symbol)) {
      err = new Error('This symbol  has already been added to this user account')
      err.status = 422
      cb(err)
      return err
    }


    this.watchList.push(token.symbol)

    const account = await this.updateAttribute('watchList', this.watchList).catch(e=>{err=e})

    if (err) {
      cb(err);
      return err
    }
    return cb(null, account)
  };

  Account.prototype.removeFromWatchList = async function (symbol, cb) {
    let watchList = this.watchList
    let err

    if(!_.includes(watchList, symbol)){
      err = new Error('This symbol does not exist for user account')
      err.status = 422
      cb(err)
      return err
    }

    watchList = _.remove(watchList, (n) => {
      return n !== symbol;
    });

    const account = await this.updateAttribute('watchList', watchList).catch(e=>{err=e})

    if (err) {
      cb(err);
      return err
    }
    return cb(null, account)


  }

  Account.prototype.addAddress = async function (data, cb) {
    //metric timing
    const start_time = new Date().getTime();

    let { address } = data;
    address = address.toLowerCase();
    let err = null
    if (!web3.utils.isAddress(address)) {
      // metrics
      measureMetric(constants.METRICS.add_address.invalid_address, start_time);

      err = new Error('Invalid ethereum address')
      err.status = 400
      cb(err)
      return err
    } else if (this.addresses.find((addressObj)=> addressObj.id.toLowerCase() === address) ) {
      err = new Error('This address has already been added to this user account')
      err.status = 422
      cb(err)
      return err
    }
    const { newAddressQueue } = app.default.queues.address
    await newAddressQueue.add({ address, userId: this.id }, { jobId: uuidv4() }).catch(e=>err=e)
    if (err) {
      cb(err);
      return err
    }
    this.addresses.push({ id: address })
    let account = await this.save().catch(e=>err=e)
    if (err) {
      err.status = 500
      cb(err);
      return err
    }
    // metrics
    measureMetric(constants.METRICS.add_address.success, start_time);
    cb(null, account)
    return account
  }

  Account.prototype.refreshAddress = async function (address, cb=()=>{}) {
    //metric timing
    const start_time = new Date().getTime();
    
    let err = null
    address = address.toLowerCase();
    
    if (!web3.utils.isAddress(address)) {
      // metrics
      measureMetric(constants.METRICS.add_address.invalid_address, start_time);
      err = new Error('Invalid ethereum address')
      err.status = 400
      cb(err)
      return err
    }
    const { backfillBalanceQueue } = app.default.queues.address
    await backfillBalanceQueue.add({ address, userId: this.id, days: 1 }, { jobId: uuidv4() }).catch(e=>err=e)
    if (err) {
      // metrics
      measureMetric(constants.METRICS.refresh_address.failed, start_time);
      cb(err)
      return err
    }
    // metrics
    measureMetric(constants.METRICS.refresh_address.success, start_time);
    cb(null)
    return
  }

  Account.prototype.deleteAddress = async function (address, cb) {
    address = address.toLowerCase();

    //metric timing
    const start_time = new Date().getTime();

    let { err, account } = await getAccount(this.id)
    if (err) {
      cb(err)
      return err
    }

    const addressIndex = account.addresses.findIndex(addressObj=>addressObj.id.toLowerCase() === address)

    if (addressIndex === -1) {

      // metrics
      measureMetric(constants.METRICS.delete_address.failed, start_time);

      err = new Error(`The address ${address} is not associated with the specified user account`)
      err.status = 404
      cb(err)
      return err
    }

    account.addresses.splice(addressIndex, 1)
    await account.save().catch(e=>err=e)
    if (err) {

      // metrics
      measureMetric(constants.METRICS.delete_address.failed, start_time);

      err = new Error('Could not update account')
      err.status = 500
      console.log(err)
      cb(err)
      return err
    }

    // metrics'
    measureMetric(constants.METRICS.delete_address.success, start_time);

    cb(null, account)
    return account
  }

  const getAccount = async (id) => {
    let err = null
    const account = await Account.findById(id).catch(e=>{err=e})

    if (!err && !account) {
      err = new Error("Account not found")
      err.status = 404
    }

    return {
      account,
      err
    }
  }

  const getTokenBySymbol = async (symbol) => {
    let err = null
    const Token = app.default.models.Token;
    const token = await Token.findOne({where: {symbol}}).catch(e=>{err=e})

    if (!err && !token) {
      err = new Error("Token not found")
      err.status = 404
    }

    return {
      token,
      err
    }
  }

  const aggregateTokens = (addresses) => {
    const uniqueTokens = {}
    let totalEther = 0
    addresses.forEach((addressObj)=>{
      totalEther += addressObj.ether || 0
      addressObj.tokens.forEach((token)=>{
        if (!uniqueTokens[token.symbol]) {
          uniqueTokens[token.symbol] = token
        } else {
          uniqueTokens[token.symbol].balance += token.balance
        }
      })
    })
    const symbols = Object.keys(uniqueTokens)
    if (totalEther) {
      uniqueTokens['ETH'] = { balance: totalEther, symbol: 'ETH' }
      symbols.unshift('ETH')
    }
    const tokens = symbols.map((symbol)=>uniqueTokens[symbol])
    return { symbols, tokens }
  };

  Account.prototype.getPortfolio = async function (cb) {

    const start_time = new Date().getTime();

    let {err, account} = await getAccount(this.id);
    if (err) {
      // metrics
      measureMetric(constants.METRICS.get_portfolio.failed, start_time);
      cb && cb(err)
      return err
    }
    const { addresses } = account
    const addressList = addresses.map(a=>a.id).join(',')
    const balances = !addressList ? {} : await app.default.models.Balance.getBalances(addressList).catch(e=>err=e)

    if (err) {
      // metrics
      measureMetric(constants.METRICS.get_portfolio.failed, start_time);
      cb && cb(err)
      return err
    }

    const symbols = Object.keys(balances)
    const symbolList = symbols.concat(account.watchList).join(',')
    let { priceMap, watchListTokens } = await all({
      priceMap: !symbolList ? {} : app.default.models.Ticker.currentPrices(symbolList, 'USD'),
      watchListTokens: getTokensBySymbol(account.watchList)
    })
    const prices = symbols.map(mapPrice.bind(null, priceMap))
    const watchListPrices = account.watchList.map(mapPrice.bind(null, priceMap))
    const watchList = watchListTokens.map((token, i)=>({
      ...token,
      ...watchListPrices[i],
      symbol: symbols[i]
    }))
    const tokens = symbols.map((symbol, i)=>({
      symbol: symbol,
      balance: balances[symbol] || 0,
      ...TOKEN_CONTRACTS[symbol],
      ...prices[i],
      priceChange: getPriceChange({...prices[i], balance: balances[symbol] || 0 }),
      priceChange7d: getPriceChange({price: prices[i].price, change: prices[i].change7d, balance: balances[symbol] || 0})
    })).sort((a,b)=>Math.abs(a.priceChange) > Math.abs(b.priceChange) ? -1 : 1)
    const totalValue = tokens.reduce(
      (acc, curr) => acc += (curr.price * curr.balance), 0);
    const totalPriceChange = tokens.reduce(
      (acc, curr) => acc + (curr.priceChange), 0)
    const totalPriceChange7d = tokens.reduce(
      (acc, curr) => acc + (curr.priceChange7d), 0)
    const totalPriceChangePct = (1-totalValue/(totalValue+totalPriceChange))*100
    const totalPriceChangePct7d = (1-totalValue/(totalValue+totalPriceChange7d))*100
    // metrics
    measureMetric(constants.METRICS.get_portfolio.failed, start_time);
    const portfolio = {
      watchList,
      tokens,
      totalValue,
      totalPriceChange,
      totalPriceChangePct,
      totalPriceChange7d,
      totalPriceChangePct7d,
      top: []
    }
    cb && cb(null, portfolio)
    return portfolio
  };

  const periodInterval = {
    '1d': '5m',
    '1w': '10m',
    '1m': '1d',
    '3m': '1d',
    '1y': '1w',
    'all': '1w'
  }

  Account.prototype.getPortfolioChart = async function (period='1m', cb) {
    let err = null
    const addressList = this.addresses.map(a=>a.id).join(',')
    const balances = !addressList ? {} : await app.default.models.Balance.getBalances(addressList).catch(e=>err=e)
    const symbols = Object.keys(balances)
    if (err || !symbols.length) {
      cb && cb(err)
      return err
    }
    const ticker = !symbols.length ? {} : await app.default.models.Ticker.historicalPrices(
      symbols.join(','), 'USD', 0, 0, 'chart', period, periodInterval[period] || '1d'
    ).catch(e=>err=e)
    if (err) {
      cb && cb(err)
      return err
    }
    if (!Object.keys(ticker).length) {
      cb(null, [])
      return []
    }
    const tsym = 'USD'
    const chartData = []
    const numBuckets = ticker[symbols[0]][tsym].length

    for (let i = 0; i < numBuckets; i++) {
      const time = ticker[symbols[0]][tsym][i].x
      const aggregatePrice = symbols.reduce((acc, symbol)=>{
        const point = ticker[symbol][tsym][i] || { y: 0 }
        return acc + (balances[symbol] * point.y)
      }, 0)
      const aggregateChange = symbols.reduce((acc, symbol)=>{
        const point = ticker[symbol][tsym][i] || { y: 0 }
        return acc + (balances[symbol] * point.change_close)
      }, 0)
      const aggregatePrevPrice = aggregatePrice - aggregateChange
      chartData.push({
        x: time,
        y: aggregatePrice,
        change_close: aggregateChange,
        change_pct: aggregatePrice > aggregatePrevPrice ?
          ((1/(aggregatePrevPrice / aggregatePrice))-1)*100 : 
          (aggregatePrice / aggregatePrevPrice) - 1
      })
    }
    cb(null, chartData)
    return chartData
  };

  const getPriceChange = ({price, balance, change}) => {
    const totalValue = price * (balance || 1)
    const prevTotalValue = totalValue / ((100+change)/100)
    const priceChange = totalValue - prevTotalValue
    return priceChange || 0
  }

  Account.prototype.getTokenMeta = async function (sym, cb) {
    let { err, account } = await getAccount(this.id)
    if (err) {
      return cb(err)
    }

    const symbol = sym.toUpperCase()
    const balances = await app.default.models.Balance.getBalances(this.addresses.map(a=>a.id).join(',')).catch(e=>err=e)
    if (err) {
      cb && cb(err)
      return err
    }
    const priceData = await app.default.models.Ticker.currentPrice(symbol, 'USD').catch(e=>err=e)
    const { price, market_cap, volume_24_hr, change_pct_24_hr } = (priceData && priceData[symbol]['USD']) ? priceData[symbol]['USD'] : {}
    let balance = balances[symbol]
    let totalValue = balance * price
    const priceChange = getPriceChange({price, balance, change: change_pct_24_hr})
    const priceChange7d = 0
    const { website, reddit, twitter, name, videoUrl } = TOKEN_CONTRACTS[symbol] || {}
    return cb(null, {
      price,
      balance,
      totalValue,
      marketCap: market_cap,
      volume24Hr: volume_24_hr,
      change: change_pct_24_hr,
      priceChange,
      priceChange7d,
      symbol,
      name,
      website,
      reddit,
      twitter,
      videoUrl
    });
  };

  Account.addNotificationToken = async function (req, data, cb) {
    const start_time = new Date().getTime();
    const { token } = data
    let {account, err} = await getAccount(req.accessToken.userId);

    if (err) {
      // metrics
      measureMetric(constants.METRICS.add_notification.failed, start_time);
      return cb(err);
    }

    let notificationTokens = account.notification_tokens;
    if(!_.includes(notificationTokens, token)){
      notificationTokens.push(token)
      const newAccount = await account.updateAttribute('notification_tokens', notificationTokens).catch(e=>{err=e})

      if (err) {
        // metrics
        measureMetric(constants.METRICS.add_notification.failed, start_time);
        return cb(err);
      }

      return cb(null, newAccount)
    }
    return cb(null, account)
  }

  Account.logout = async function(accessToken, data, fn) {
    fn = fn || utils.createPromiseCallback();
    let tokenId = accessToken && accessToken.id
    const { notification_token } = data

    if (!tokenId) {
      const err = new Error('accessToken is required to logout');
      err.status = 401;
      process.nextTick(fn, err);
      return fn.promise;
    }

    if (!notification_token) {
      const err = new Error('Notification Token is required to logout');
      err.status = 401;
      process.nextTick(fn, err);
      return fn.promise;
    }

    let {account, err} = await getAccount(accessToken.userId)

    if(err){
      return fn(err);
    }

    let notificationTokens = account.notification_tokens;
    notificationTokens = notificationTokens.filter((e) => e !== notification_token)

    account.updateAttribute('notification_tokens', notificationTokens).catch(e=>{err=e})

    if(err){
      return fn(err);
    }

    const info = this.relations.accessTokens.modelTo.destroyById(tokenId).catch(e=>{err=e})

    if (err) {
      fn(err);
    } else if ('count' in info && info.count === 0) {
      err = new Error('Could not find accessToken');
      err.status = 401;
      fn(err);
    } else {
      fn();
    }

    return fn.promise;
  };

  Account.validatesLengthOf('password', {min: 5, message: {min: 'Password should be at least 5 characters'}});

  Account.afterRemoteError('prototype.login', function(ctx, next) {
    const start_time = new Date().getTime() - 10;
    measureMetric(constants.METRICS.login.failed, (start_time));
  });

  Account.remoteMethod('logout', {
      description: 'Logout a user with access token.',
      accepts: [
        {arg: 'access_token', type: 'object', http: function(ctx) {
          let req = ctx && ctx.req;
          let accessToken = req && req.accessToken;
          //var tokenID = accessToken ? accessToken.id : undefined;

          return accessToken;
        }, description: 'Do not supply this argument, it is automatically extracted ' +
        'from request headers.',
        },
        {arg: 'data', type: 'object', http: { source: 'body'}, description: 'Notification Token'}
      ],
      http: {verb: 'all'},
    }
  );

  Account.remoteMethod('getTokenMeta', {
    isStatic: false,
    http: {
      path: '/portfolio/token/:symbol',
      verb: 'get'
    },
    accepts: {
      arg: 'symbol',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      root: true,
      type: 'account'
    },
    description: 'Shows metadata information details for a token'
  });

  Account.remoteMethod('addNotificationToken', {
    http: {
      path: '/push-token',
      verb: 'post'
    },
    accepts:[
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
      {arg: 'data', type: 'object', http: { source: 'body'}, description: 'token'}
    ],
    returns: {
      root: true,
    },
    description: 'Update User Notification token'
  });

  Account.remoteMethod('register', {
    http: {
      path: '/register',
      verb: 'post',
    },
    accepts: {
      arg: 'data',
      type: 'object',
      http: {
        source: 'body',
      },
      description: 'Ethereum address',
    },
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Registers a User\'s deviceId in the database',
  });

  Account.remoteMethod('addAddress', {
    isStatic: false,
    http: {
      path: '/address',
      verb: 'post',
    },
    accepts: [
      {
        arg: 'address',
        type: 'object',
        http: {
          source: 'body',
        },
        description: 'Ethereum address',
      }
    ],
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Add an ethereum address to a user\'s account',
  });

  Account.remoteMethod('addToWatchList', {
    isStatic: false,
    http: {
      path: '/watch-list',
      verb: 'post',
    },
    accepts: [
      {
        arg: 'watchlist',
        type: 'object',
        http: {
          source: 'body',
        },
        description: 'Watch List Symbol',
      }
    ],
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Add watchlist to a user\'s account',
  });

  Account.remoteMethod('removeFromWatchList', {
    isStatic: false,
    http: {
      path: '/watch-list/:symbol',
      verb: 'delete',
    },
    accepts: [
      {
        arg: 'symbol',
        type: 'string',
        http: {
          source: 'path'
        },
        description: 'symbol',
      }
    ],
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Delete a symbol from watchlist.',
  });

  Account.remoteMethod('refreshAddress', {
    isStatic: false,
    http: {
      path: '/address/:address/refresh',
      verb: 'post',
    },
    accepts: {
      arg: 'address',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      root: true,
    },
    description: ['Updates the total balance for the specified Ethereum Address ',
      'as well as tokens with non-zero balances'],
  });

  Account.remoteMethod('deleteAddress', {
    isStatic: false,
    http: {
      path: '/address/:address',
      verb: 'delete',
    },
    accepts: {
      arg: 'address',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Delete an ethereum address from a user\'s account'
  });

  Account.remoteMethod('getPortfolio', {
    isStatic: false,
    http: {
      path: '/portfolio',
      verb: 'get',
    },
    returns: {
      root: true,
    },
    description: ['Gets the total balance for the specified Ethereum Address ',
      'as well as its tokens, their respective prices, and balances'],
  });

  Account.remoteMethod('getPortfolioChart', {
    isStatic: false,
    http: {
      path: '/portfolio-chart',
      verb: 'get',
    },
    accepts: {
      arg: 'period',
      type: 'string',
      http: {
        source: 'query'
      }
    },
    returns: {
      root: true,
    },
    description: ['Gets the total balance across all ethereum addresses',
      'as well as its tokens, their respective prices, and balances'],
  });
};
