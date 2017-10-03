import {
	getContractAddress,
	getTokenInfo,
  getPriceForSymbol,
} from '../../utils/eth.js';

module.exports = function(Token) {
  Token.getInfo = async(symbol, cb) => {
    const contractAddress = getContractAddress(symbol) || symbol;
    const token = await getTokenInfo(contractAddress);
    return cb(null, {token});
  };

  Token.getSymbolPrice = async(symbol, cb) => {
    symbol = symbol.toUpperCase;
    const price = await getPriceForSymbol(symbol, 'USD');
    return cb(null, {price});
  };

  Token.remoteMethod('getInfo', {
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
      name: 'info',
      type: 'object',
    },
    description: 'Gets information about the specified token',
  });

  Token.remoteMethod('getSymbolPrice', {
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
};
