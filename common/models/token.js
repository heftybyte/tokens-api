module.exports = function(Token) {
  Token.getTokens = (cb) => {
    Token.find().then(tokens => {
      tokens = tokens.map(({id, decimals, symbol, address}) =>({
        id, decimals, symbol, address,
        imageUrl: `/img/tokens/${symbol.toLowerCase()}.png`,
      })).sort((a, b)=>a.symbol > b.symbol ? 1 : -1);
      cb(null, tokens);
    });
  };

  Token.remoteMethod('getTokens', {
    http: {
      path: '/',
      verb: 'get',
    },
    description: 'fetch all tokens',
    returns: {
      root: true,
      type: 'array',
    },
  });

  Token.disableRemoteMethodByName('find');
};
