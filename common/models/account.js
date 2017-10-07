import {
  getAllTokenBalances
} from '../../utils/eth.js';

module.exports = function(Account) {

  Account.getPortfolio = async (id, cb) => {
    let err = null
    const account = await Account.findById(id).catch(e=>{err=e})
    
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

    const address = JSON.parse(account.addresses[0]) // TODO: fetch for multiple addresses
    const balances = await getAllTokenBalances(address)
    const totalValue = balances.reduce((acc, token)=>{
      return acc + (token.price * token.balance);
    }, 0);
    return cb(null, {totalValue, balances})
  
  };

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

  Account.remoteMethod('getPortfolio', {
    http: {
      path: '/:id/portfolio',
      verb: 'get',
    },
    accepts: {
      arg: 'id',
      type: 'string',
      'http': {
        source: 'path',
      },
      description: 'The id of the user',
      required: true,
    },
    returns: {
      name: 'portfolio',
      type: 'object',
    },
    description: ['Gets the total balance for the specified Ethereum Address ',
      'as well as its tokens, their respective prices, and balances'],
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
      description: 'Should be a json payload containing the deviceId',
    },
    returns: { 
      "root": true,
      "type": "account"
    },
    description: 'Registers a User\'s deviceId in the database',
  });
};
