import {
  getContractAddress,
  getETHBalance,
  getTokenBalance,
  getAllTokenBalances,
  getPriceForSymbol,
  getTokenInfo
} from '../../lib/eth.js';

module.exports = function(Eth) {

  Eth.getBalance = async(address, cb) => {
    const balance = await getETHBalance(address);
    return cb(null, balance);
  };

  Eth.getToken = async(symbol, cb) => {
    const contractAddress = getContractAddress(symbol) || symbol;
    const token = await getTokenInfo(contractAddress);
    return cb(null, token);
  };

  Eth.getTokenBalance = async(address, symbol, cb) => {
    const contractAddress = getContractAddress(symbol) || symbol;
    const balance = await getTokenBalance(contractAddress, address);
    return cb(null, balance);
  };

  Eth.getTokenPrice = async(symbol, cb) => {
    symbol = symbol.toUpperCase();
    const price = await getPriceForSymbol(symbol, 'USD');
    return cb(null, price);
  };

  Eth.remoteMethod('getBalance', {
    http: {
      path: '/:address/balance',
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
    accessScopes: null
  });

  Eth.remoteMethod('getToken', {
    http: {
      path: '/token/:symbol',
      verb: 'get',
    },
    accepts: {
      arg: 'symbol',
      type: 'string',
      http: {
        source: 'path',
      },
      description: 'The Token Symbol to get information about',
      required: true,
    },
    returns: {
      name: 'token',
      type: 'object',
    },
    description: 'Gets information about the specified token',
  });

  Eth.remoteMethod('getTokenBalance', {
    http: {
      path: '/:address/token/:symbol/balance',
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
  Eth.remoteMethod('getTokenPrice', {
    http: {
      path: '/token/:symbol/price',
      verb: 'get',
    },
    accepts: {
      arg: 'symbol',
      type: 'string',
      http: {
        source: 'path',
      },
      description: 'The Token Symbol to get price for',
      required: true,
    },
    returns: {
      name: 'price',
      type: 'string',
    },
    description: 'Gets the price of the specified token',
  });

  Eth.disableRemoteMethodByName('findById');
};
