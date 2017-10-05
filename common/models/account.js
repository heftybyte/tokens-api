import {
	getContractAddress,
	getETHBalance,
	getTokenBalance,
	getAllTokenBalances,
} from '../../utils/eth.js';

module.exports = function(Account) {
  Account.getBalance = async(address, cb) => {
    const balance = await getETHBalance(address);
    return cb(null, balance);
  };

  Account.getTokenBalance = async(address, symbol, cb) => {
    const contractAddress = getContractAddress(symbol) || symbol;
    const balance = await getTokenBalance(contractAddress, address);
    return cb(null, balance);
  };

  Account.getTokens = async(address, cb) => {
    const contractAddress = getContractAddress(address) || address;
    const balances = await getAllTokenBalances(contractAddress);
    const totalValue = balances.reduce((acc, token)=>{
      return acc + (token.price * token.balance);
    }, 0);
    return cb(null, {totalValue, balances});
  };

  Account.registerDevice = (data, cb) => {
    Account.create(data, (err, instance) => {
      if (err) {
        const error = new Error(err.message);
        error.status = 400;
        cb(error);
      } else {
        cb(null);
      }
    });
  };

  Account.remoteMethod('getBalance', {
    http: {
      path: '/:address',
      verb: 'get',
    },
    accepts: {
      arg: 'address',
      type: 'string',
      http: {
        source: 'path',
      },
      description: 'The address of the Ethereum Wallet',
      required: true,
    },
    returns: {
      name: 'balance',
      type: 'string',
    },
    description: 'Gets the total balance of the specified Ethereum address',
  });

  Account.remoteMethod('getTokenBalance', {
    http: {
      path: '/:address/token/:symbol',
      verb: 'get',
    },
    accepts: [
      {
        arg: 'address',
        type: 'string',
        http: {
          source: 'path',
        },
        description: 'The address of the Ethereum Wallet',
        required: true,
      },
      {
        arg: 'symbol',
        type: 'string',
        http: {
          source: 'path',
        },
        description: 'The Token Symbol to get the balance for',
        required: true,
      },
    ],
    returns: {
      name: 'balance',
      type: 'string',
    },
    description: ['Gets the balance of a particular token ',
      'for the specified Ethereum Address '],
  });

  Account.remoteMethod('getTokens', {
    http: {
      path: '/:address/tokens',
      verb: 'get',
    },
    accepts: {
      arg: 'address',
      type: 'string',
      'http': {
        source: 'path',
      },
      description: 'The address of the Ethereum Wallet',
      required: true,
    },
    returns: {
      name: 'balance and tokens',
      type: 'object',
    },
    description: ['Gets the total balance for the specified Ethereum Address ',
      'as well as its tokens, their respective prices, and balances'],
  });

  Account.remoteMethod('registerDevice', {
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
      returns: {
        name: 'status',
        type: 'object',
      },
      description: 'Should be a json payload containing the deviceId',
    },
    description: 'Registers a User\'s deviceId in the database',
  });
  Account.disableRemoteMethodByName('findById');
};
