import server from '../server';
import tokenData from '../../data/tokens.json';

const Token = server.models().filter(model => model.modelName === 'Token')[0];

const symbolArr = Object.keys(tokenData);

const tokens = symbolArr.map(symbol => {
  return {
    symbol,
    address: tokenData[symbol].address,
    decimals: tokenData[symbol].decimals,
  };
});

const savePromises = tokens.map(token => Token.create(token));
Promise.all(savePromises)
  .then(console.log('Seeded tokens collection.'));
