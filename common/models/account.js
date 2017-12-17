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
let app = require('../../server/server');
const _ = require('lodash')
const constants = require('../../constants/');
const TOP_N = 100
import { measureMetric } from '../../lib/statsd';

import web3 from '../../lib/web3'

const INVITE_ENABLED = false

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
    } else if ( this.addresses.find((addressObj)=> addressObj.id.toLowerCase() === address) ) {
      err = new Error('This address has already been added to this user account')
      err.status = 422
      cb(err)
      return err
    }

    this.addresses.push({ id: address })
    let account = await this.save().catch(e=>err=e)
    if (err) {
      cb(err);
      return err
    }

    // metrics
    measureMetric(constants.METRICS.add_address.success, start_time);

    account = await this.refreshAddress(address)
    cb(null, account)
    return account
  }

  Account.prototype.refreshAddress = async function (address, cb=()=>{}) {
    //metric timing
    const start_time = new Date().getTime();
    address = address.toLowerCase();

    let { err, account } = await getAccount(this.id);
    if (err) {

      // metrics
      measureMetric(constants.METRICS.refresh_address.success, start_time);

      cb(err)
      return err
    }

    const tokens = await getAllTokenBalances(address).catch(e=>err=e)
    if (err) {

      // metrics
      measureMetric(constants.METRICS.refresh_address.failed, start_time);

      cb(err)
      return err
    }

    //get address eth balance
    const _ethBalance = await getEthAddressBalance(address).catch(e=>err=e)
    if (err) {

      // metrics
      measureMetric(constants.METRICS.refresh_address.failed, start_time);

      cb(err)
      return err
    }
    const ethBalance = _ethBalance.addressBalance
    const addressObj = account.addresses.find((addressObj)=>addressObj.id.toLowerCase() === address)
    addressObj.tokens = tokens.filter(token=>token.balance)
    addressObj.ether = ethBalance
    account.save()

    // metrics
    measureMetric(constants.METRICS.refresh_address.success, start_time);

    cb(null)
    return account
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

    const {err, account} = await getAccount(this.id);
    if (err) {

      // metrics
      measureMetric(constants.METRICS.get_portfolio.failed, start_time);

      return cb(err);
    }
    const { addresses } = account
    
    const { symbols, tokens: currentTokens } = aggregateTokens(addresses)

    let { top, prices, watchList } = await all({
      top: getTopNTokens(TOP_N),
      prices: getTokenPrices(symbols),
      watchList: getTokensBySymbol(account.watchList)
    })
    top = (top || []).map((token)=>({
      ...token,
       ...TOKEN_CONTRACTS[token.symbol]
    }))
    const tokens = currentTokens.map((token, i)=>({
      symbol: token.symbol,
      balance: token.balance,
      ...TOKEN_CONTRACTS[token.symbol],
      ...prices[i],
      priceChange: getPriceChange({...prices[i], balance: token.balance}),
      priceChange7d: getPriceChange({price: prices[i].price, change: prices[i].change7d, balance: token.balance})
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
      top
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
    const { symbols: fsyms, tokens } = aggregateTokens(this.addresses)
    const ticker = await app.default.models.Ticker.historicalPrices(
      fsyms.join(','), 'USD', 0, 0, 'chart', period, periodInterval[period] || '1d'
    )
    const tsym = 'USD'
    const symbols = Object.keys(ticker)
    if (!symbols.length) {
      cb && cb(null)
      return []
    }

    let foundPrice
    let timeIndex = 0
    const chartData = []
    do {
      const aggregatePoint = { x: 0, y: 0 }
      foundPrice = false
      tokens.forEach(token=>{
        if (!token.balance || !ticker[token.symbol] || !ticker[token.symbol][tsym]) {
          return
        }
        const point = ticker[token.symbol][tsym][timeIndex]
        if (!point || !point.x || !point.y) {
          return
        } else {
          foundPrice = true
        }
        aggregatePoint.x = point.x
        aggregatePoint.y += point.y * token.balance
      })
      if (foundPrice) {
        chartData.push(aggregatePoint)
      }
      timeIndex++
    } while(foundPrice)
    //'fsym', 'tsym', 'start', 'end', 'format', 'period', 'interval'
    return cb(null, chartData)
  };

  const getPriceChange = ({price, balance, change}) => {
    const totalValue = price * balance
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
    const balances = []
    const { price, marketCap, volume24Hr, change, change7d, supply } = await getPriceForSymbol(symbol, 'USD');
    let balance = 0
    let totalValue = 0
    account.addresses.forEach(addressObj => {
      const token = addressObj.tokens.filter(obj => obj.symbol === symbol)[0]

      if (token) {
        balances.push(token.balance)
        return
      } else if (symbol === 'ETH') {
        balance += addressObj.ether
      }
    })

    balance += balances.reduce((init, nxt) => init + nxt, balance)
    totalValue += balance * price
    const priceChange = getPriceChange({price, balance, change})
    const priceChange7d = getPriceChange({ price, change: change7d, balance })
    const { website, reddit, twitter, name, videoUrl } = TOKEN_CONTRACTS[symbol] || {}
    return cb(null, {
      price,
      balance,
      totalValue,
      marketCap,
      volume24Hr,
      change,
      supply,
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
