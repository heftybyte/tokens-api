import {
  getAllTokenBalances
} from '../../lib/eth.js';

import web3 from '../../lib/web3'

module.exports = function(Account) {
  Account.register = (data, cb) => {
    Account.create(data, (err, instance) => {
      if (err) {
        const error = new Error(err.message);
        error.status = 400;
        cb(error);
      } else {
        cb(null, instance);
      }
    });
  };

  Account.login = function(credentials, include, fn) {
    Account.findOne({where: credentials}, function(err, user) {
      var defaultError = new Error('login failed');
      defaultError.statusCode = 401;
      defaultError.code = 'LOGIN_FAILED';

      function tokenHandler(err, token) {
        if (err) return fn(err);
        if (Array.isArray(include) ? include.indexOf('user') !== -1 : include === 'user') {
          token.__data.user = user;
        }
        fn(err, token);
      }

      if (err) {
        console.log('An error is reported from User.findOne: %j', err);
        fn(defaultError);
      } else if (user) {
        if (Account.settings.emailVerificationRequired && !user.emailVerified) {
          // Fail to log in if email verification is not done yet
          console.log('User email has not been verified');
          err = new Error('login failed as the email has not been verified');
          err.statusCode = 401;
          err.code = 'LOGIN_FAILED_EMAIL_NOT_VERIFIED';
          err.details = {
            userId: user.id,
          };
          fn(err);
        } else {
          if (user.createAccessToken.length === 2) {
            user.createAccessToken(credentials.ttl, tokenHandler);
          } else {
            user.createAccessToken(credentials.ttl, credentials, tokenHandler);
          }
        }
      } else {
        console.log('No matching record is found for user %s', credentials.id);
        fn(defaultError);
      }
    });
    return fn.promise;
  };

  Account.prototype.addAddress = async function (data, cb) {
    const { address } = data
    let err = null
    if (!web3.utils.isAddress(address)) {
      err = new Error('Invalid ethereum address')
      err.status = 400
      return cb(err)
    }
    this.addresses.push(JSON.stringify(address))
    const account = await this.save().catch(e=>err=e)
    if (err) {
      return cb(err);
    }
    return cb(null, account)
  }

  Account.prototype.getPortfolio = async function (cb) {
    let err = null
    const account = await Account.findById(this.id).catch(e=>{err=e})
    
    if (!err && !account) {
      err = new Error("Account not found")
      err.status = 404
    } else if (!account.addresses.length) {
      err = new Error('No addresses associated with this account')
      err.status = 404
    }

    if (err) {
      return cb(err)
    }

    const address = account.addresses[0] // TODO: fetch for multiple addresses
    const tokens = (await getAllTokenBalances(address)).map((token)=>({
      ...token,
      imageUrl: `/img/tokens/${token.symbol.toLowerCase()}.png`      
    }))
    const totalValue = tokens.reduce((acc, token)=>{
      return acc + (token.price * token.balance);
    }, 0);
    return cb(null, {totalValue, tokens})
  
  };

  Account.remoteMethod('register', {
    http: {
      path: '/register',
      verb: 'post',
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
