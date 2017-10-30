import {
  getAllTokenBalances,
  getTokenBalance,
  getContractAddress,
  getPriceForSymbol
} from '../../lib/eth.js';
let app = require('../../server/server');

import web3 from '../../lib/web3'

module.exports = function(Account) {
  Account.register = (data, cb) => {
	  let invite = app.default.models.Invite;
	  invite.findOne({where: {invite_code: data.code}}, (err, code) => {
			if(err){
				console.log('An error is reported from Invite.findOne: %j', err)
				const error = new Error(err.message);
				error.status = 400;
				return cb(error);
			}

			if(code){
				delete data.code
				Account.create(data, (err, instance) => {
					if (err) {
						const error = new Error(err.message);
						error.status = 400;
						return cb(error);
					}
					invite.destroyById(code.id, (err, info) => {
						if(err){
							console.log('An error is reported from Invite.destroyById: %j', err)
						}
					})
					cb(null, instance);
				});
			} else {
				const error = new Error("You need Invitation code to Register");
				error.statusCode = 400;
				return cb(error);
			}
	  })
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
    } else if (!err && account && !account.addresses.length) {
      err = new Error('No addresses associated with this account')
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
    const totalValue = filteredTokens.reduce(
      (acc, curr) => acc += (curr.price * curr.balance), 0);
    return cb(null, {tokens: filteredTokens, totalValue});
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
