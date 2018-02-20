import server from '../server/server';
import Hash from 'object-hash';
import tokenData from '../data/tokens.json';
import redisClient from '../server/boot/redisConnector';

const storeInRedis = (redisClient, tokens, checksum) => {
  if (!redisClient) return;
  redisClient.set('tokenChecksum', checksum);
  redisClient.set('tokens', JSON.stringify(tokens));
  redisClient.quit();
};

async function run() {
  
  const Token = server.models.Token;

  const tokens = Object.keys(tokenData)
    .map(symbol => ({
      symbol,
      ...tokenData[symbol],
      id: tokenData[symbol].id || symbol
    }));


  await Token.destroyAll()

  const savePromises = tokens.sort((a, b)=>a.symbol > b.symbol ? 1 : -1)
    .map(token => Token.upsertWithWhere({ symbol: token.symbol }, token));

  Promise.all(savePromises)
    .then((tokens) => {
      const tokensJSON = tokens.map((token)=>token.toJSON());
      const checksum = Hash(Object.keys(tokensJSON));
      console.log(checksum, 'tokens hash');
      console.log('Seeded tokens collection.');
      storeInRedis(redisClient, tokensJSON, checksum);
      console.log('Cached tokens in redis.');
      process.exit()
    })
  .catch(e=>console.log(e))

};

run()