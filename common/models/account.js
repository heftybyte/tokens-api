import {
  getAllTokenBalances,
  getTokenBalance,
  getContractAddress,
  getPriceForSymbol,
  getEthAddressBalance,
  getTopNTokens,
  getTokenPrices
} from '../../lib/eth.js';
import { all } from '../../lib/async-promise';
let app = require('../../server/server');

const constants = require('../../constants/');

import { measureMetric } from '../../lib/statsd';

import web3 from '../../lib/web3'

module.exports = function(Account) {
  Account.register = async (data, cb) => {

    //metric timing
    const start_time = new Date().getTime();
    
    let err = null, Invite = app.default.models.Invite;

    const invite = await Invite.findOne({where: {invite_code: data.code}}).catch(e=>err=e)
    if (err){

      // metrics
      measureMetric(constants.METRICS.register.failed, start_time);

      console.log('An error is reported from Invite.findOne: %j', err)
      err = new Error(err.message);
      err.status = 400;
      return cb(err);
    }

    if (!invite) {

      // metrics
      measureMetric(constants.METRICS.register.invalid_code, start_time);

      err = new Error("You need a valid invitation code to register.\nTweet @tokens_express to get one.");
      err.statusCode = 400;
      return cb(err);
    } else if (!invite.claimed) {

      // metrics
      measureMetric(constants.METRICS.register.success, start_time);

      delete data.code
      const instance = await Account.create(data).catch(e=>err=e)
      if (err) {
        err = new Error(err.message);
        err.status = 400;
        return cb(err);
      }
      invite.claimed = true
      await invite.save().catch(e=>err=e)
      if (err) {
        console.log('unable to update claimed invite: %j', err)
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

  Account.prototype.addAddress = async function (data, cb) {

    //metric timing
    const start_time = new Date().getTime();

    const { address } = data
    let err = null
    if (!web3.utils.isAddress(address)) {

      // metrics
      measureMetric(constants.METRICS.add_address.invalid_address, start_time);

      err = new Error('Invalid ethereum address')
      err.status = 400
      cb(err)
      return err
    } else if ( this.addresses.find((addressObj)=>addressObj.id === address) ) {
      err = new Error('This address has already been added to this user account')
      err.status = 422
      cb(err)
      return err
    }

    this.addresses.push({ id: address })
    const account = await this.save().catch(e=>err=e)
    if (err) {
      cb(err);
      return err
    }
    
    // metrics
    measureMetric(constants.METRICS.add_address.success, start_time);

    await this.refreshAddress(address)
    cb(null, account)
    return account
  }

  Account.prototype.refreshAddress = async function (address, cb=()=>{}) {
    //metric timing
    const start_time = new Date().getTime();

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
    const addressObj = account.addresses.find((addressObj)=>addressObj.id === address)
    addressObj.tokens = tokens.filter(token=>token.balance)
    addressObj.ether = ethBalance
    account.save()

    // metrics
    measureMetric(constants.METRICS.refresh_address.success, start_time);

    cb(null)
    return
  }

  Account.prototype.deleteAddress = async function (address, cb) {

    //metric timing
    const start_time = new Date().getTime();

    let { err, account } = await getAccount(this.id)
    if (err) {
      cb(err)
      return err
    }

    const addressIndex = account.addresses.findIndex(addressObj=>addressObj.id === address)

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

  Account.prototype.getPortfolio = async function (cb) {

    const start_time = new Date().getTime();

    const {err, account} = await getAccount(this.id);
    if (err) {

      // metrics
      measureMetric(constants.METRICS.get_portfolio.failed, start_time);

      return cb(err);
    }
    const { addresses } = account
    let uniqueTokens = {}
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
      .sort((a, b)=>a > b ? 1 : -1)
    if (totalEther) {
      uniqueTokens['ETH'] = { balance: totalEther, symbol: 'ETH' }
      symbols.unshift('ETH')
    }
    const currentTokens = symbols.map((symbol)=>uniqueTokens[symbol])
    
    let { top, prices } = await all({
      top: getTopNTokens(100),
      prices: getTokenPrices(symbols)
    })
    top = (top || []).map((token)=>({
      ...token,
      imageUrl: `/img/tokens/${token.symbol.toLowerCase()}.png`
    }))
    const tokens = currentTokens.map((token, i)=>({
      symbol: token.symbol,
      balance: token.balance,
      imageUrl: `/img/tokens/${token.symbol.toLowerCase()}.png`,
      ...prices[i]
    }))
    const totalValue = tokens.reduce(
      (acc, curr) => acc += (curr.price * curr.balance), 0);

    // metrics
    measureMetric(constants.METRICS.get_portfolio.failed, start_time);

    return cb(null, {tokens, totalValue, top});
  };

  Account.prototype.getTokenMeta = async function (sym, cb) {
    let { err, account } = await getAccount(this.id)
    if (err) {
      return cb(err)
    }

    const symbol = sym.toUpperCase()
    const address = JSON.parse(account.addresses[0])
    const { price, marketCap, volume24Hr } = await getPriceForSymbol(symbol, 'USD');
    const quantity = await getTokenBalance(getContractAddress(symbol), address)
    const totalValue = quantity * price

    return cb(null, {price, quantity, totalValue, marketCap, volume24Hr});
  };

	Account.addNotificationToken = async function (req, data, cb) {
    const start_time = new Date().getTime();

		const { token } = data
		let {err, account} = await getAccount(req.accessToken.userId);
		if (err) {

      // metrics
      measureMetric(constants.METRICS.add_notification.failed, start_time);

			return cb(err);
		}

		let newAccount = await account.updateAttribute('notification_token', token).catch(e=>{err=e})
		if (err) {
      // metrics
      measureMetric(constants.METRICS.add_notification.failed, start_time);
      
			return cb(err);
		}

    // metrics
    measureMetric(constants.METRICS.add_notification.success, start_time);

		return cb(null, newAccount)
	}

	Account.logout = function(accessToken, fn) {
		fn = fn || utils.createPromiseCallback();
		let tokenId = accessToken && accessToken.id

		let err;
		if (!tokenId) {
			err = new Error('accessToken is required to logout');
			err.status = 401;
			process.nextTick(fn, err);
			return fn.promise;
		}

		getAccount(accessToken.userId).then(account=>{
			account.updateAttribute('notification_token', null).catch(e=>{err=e})
		}).catch(e=>{err=e});

		this.relations.accessTokens.modelTo.destroyById(tokenId, function(err, info) {
			if (err) {
				fn(err);
			} else if ('count' in info && info.count === 0) {
				err = new Error('Could not find accessToken');
				err.status = 401;
				fn(err);
			} else {
				fn();
			}
		});
		return fn.promise;
	};

  Account.validatesLengthOf('password', {min: 5, message: {min: 'Password should be at least 5 characters'}});

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
};
