import {
  getAllTokenBalances,
  getTokenBalance,
  getContractAddress,
  getPriceForSymbol,
  getEthAddressBalance,
  getTopNTokens
} from '../../lib/eth.js';
let app = require('../../server/server');

import web3 from '../../lib/web3'

module.exports = function(Account) {
  Account.register = async (data, cb) => {
    let err = null, Invite = app.default.models.Invite;

    const invite = await Invite.findOne({where: {invite_code: data.code}}).catch(e=>err=e)
    if (err){
      console.log('An error is reported from Invite.findOne: %j', err)
      err = new Error(err.message);
      err.status = 400;
      return cb(err);
    }

    if (!invite) {
      err = new Error("You need a valid invitation code to register.\nTweet @tokens_express to get one.");
      err.statusCode = 400;
      return cb(err);
    } else if (!invite.claimed) {
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
      err = new Error("This invite has already been claimed.\nTweet @tokens_express to get a new one.");
      err.statusCode = 400;
      return cb(err);
    }
  };

  Account.prototype.addAddress = async function (data, cb) {
    const { address } = data
    let err = null
    if (!web3.utils.isAddress(address)) {
      err = new Error('Invalid ethereum address')
      err.status = 400
      return cb(err)
    } else if ( this.addresses.includes(address) ) {
      err = new Error('This address has already been added to this user account')
      err.status = 422
      return cb(err)
    }

    this.addresses.push(address)
    const account = await this.save().catch(e=>err=e)
    if (err) {
      return cb(err);
    }
    return cb(null, account)
  }

  Account.prototype.deleteAddress = async function (address, cb) {
    let { err, account } = await getAccount(this.id)
    if (err) {
      return cb(err)
    }

    const addressIndex = account.addresses.indexOf(address)

    if (addressIndex === -1) {
      err = new Error(`The address ${address} is not associated with the specified user account`)
      err.status = 404
      return cb(err)
    }

    account.addresses.splice(addressIndex, 1)
    await account.save();

    return cb(null, account)
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
    let {err, account} = await getAccount(this.id);
    if (err) {
      return cb(err);
    }

    //get all balance requests as promises
    const tokenBalancesPromises = account.addresses.map((address) => {
      address = address.replace(/\W+/g, '');
      return getAllTokenBalances(address);
    });

    // get actual token data in arrays
    const balances = await Promise.all(tokenBalancesPromises)
      .catch(e=> {
        const error = new Error('An error occurred fetching your portfolio');
        error.status = 400;
        return cb(null, error);
      });
    // concat all arrays into one which might include duplicates
    let tokens = balances.reduce((acc, curr) => acc.concat(curr), [])

    const aggregateTokenBalances = {}

    // filter duplicates out
    tokens.forEach(token => {
      // use a lookup map to find duplicates
      if (aggregateTokenBalances[token.symbol]) {
        aggregateTokenBalances[token.symbol].balance += token.balance
      } else {
        aggregateTokenBalances[token.symbol] = token
      }
    });

    const filteredTokens = Object.keys(aggregateTokenBalances).map((symbol)=>{
      const token = aggregateTokenBalances[symbol]
      return {
        ...token,
        imageUrl: `/img/tokens/${token.symbol.toLowerCase()}.png`
      }
    }).sort((a, b)=>a.symbol > b.symbol ? 1 : -1)

    // get the total value of all unique tokens
    let totalValue = filteredTokens.reduce(
      (acc, curr) => acc += (curr.price * curr.balance), 0);

    //get all address eth balance
    const addressBalancesPromises = account.addresses.map((address) => {
      address = address.replace(/\W+/g, '');
      return getEthAddressBalance(address);
    });

    const ethBalances = await Promise.all(addressBalancesPromises)
      .catch(e=>err=e)

    if (err) {
      return cb(err);
    }

    const promises = [getTopNTokens(10)]

    let totalEthBalance = ethBalances.reduce((acc, balance) => {
      return acc + Number(balance.addressBalance)
    }, 0)
    if (totalEthBalance) {
      promises.push(getPriceForSymbol('ETH', 'USD'))
    }
    const responses = await Promise.all(promises).catch(e=>err=e)

    if (err) {
      console.log('getPortfolio error', err)
      return cb(err)
    }

    const top = (responses[0] || []).map((token)=>({
      ...token,
      imageUrl: `/img/tokens/${token.symbol.toLowerCase()}.png`      
    }))
    const eth = responses[1]

    if (eth) {
      delete eth.marketCap
      delete eth.volume24Hr
      filteredTokens.unshift({
        balance: totalEthBalance,
        imageUrl: '/img/tokens/eth.png',
        symbol: 'ETH',
        ...eth,
      })
      totalValue += totalEthBalance * eth.price
    }

    return cb(null, {tokens: filteredTokens, totalValue, top});
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
		const { token } = data
		let {err, account} = await getAccount(req.accessToken.userId);
		if (err) {
			return cb(err);
		}

		let newAccount = await account.updateAttribute('notification_token', token).catch(e=>{err=e})
		if (err) {
			return cb(err);
		}
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

		if(err){
			return fn(err);
		}

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
