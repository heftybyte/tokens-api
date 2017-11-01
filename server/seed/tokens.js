import server from '../server';
import Hash from 'object-hash';
import tokenData from '../../data/tokens.json';
import redisClient from '../../server/boot/redisConnector';

const TOKEN_CACHE_TTL = 30;

const Token = server.models.Token;

const tokens = Object.keys(tokenData)
  .map(symbol => ({
    symbol,
    address: tokenData[symbol].address,
    decimals: tokenData[symbol].decimals,
    imageUrl: `/img/tokens/${symbol.toLowerCase()}.png`,
  }));

const savePromises = tokens.sort((a, b)=>a.symbol > b.symbol ? 1 : -1)
  .map(token => Token.create(token));

Promise.all(savePromises)
  .then((tokens) => {
    // very weird error when I try to hash the object directly
    // says cannot read property statusCode of undefined.
    // there's no statusCode property
    const checksum = Hash(JSON.stringify(tokens));
    console.log(checksum, 'tokens hash');
    console.log('Seeded tokens collection.');
    storeInRedis(redisClient, tokens, checksum);
    console.log('Cached tokens in redis.');
  });

const storeInRedis = (redisClient, tokens, checksum) => {
  if (!redisClient) return;
  redisClient.set('tokenChecksum', checksum, 'EX', TOKEN_CACHE_TTL);
  redisClient.set('tokens', JSON.stringify(tokens), 'EX', TOKEN_CACHE_TTL);
  redisClient.quit();
};
