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

  Account.getPortfolio = async(address, cb) => {
    const contractAddress = getContractAddress(address) || address;
    const balances = await getAllTokenBalances(contractAddress);
    const totalValue = balances.reduce((acc, token)=>{
      return acc + (token.price * token.balance);
    }, 0);
    return cb(null, {totalValue, balances});
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

  Account.remoteMethod('getPortfolio', {
    http: {
      path: '/:address/portfolio',
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
      name: 'portfolio',
      type: 'object',
    },
    description: ['Gets the total balance for the specified Ethereum Address ',
      'as well as its tokens, their respective prices, and balances'],
  });
  Account.disableRemoteMethodByName('findById');
};
