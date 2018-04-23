import server from '../server/server';
import Hash from 'object-hash';
import tokenData from '../data/tokens.json';
import redisClient from '../server/boot/redisConnector';

const storeInRedis = async (redisClient, tokens, checksum) => {
  if (!redisClient) return;
  await redisClient.setAsync('tokenChecksum', checksum);
  await redisClient.setAsync('tokens', JSON.stringify(tokens));
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
    .then(async (tokens) => {
      const symbols = tokens.map((token)=>token.symbol);
      const tokensJSON = tokens.map((token)=>token.toJSON());
      const checksum = Hash(symbols);
      console.log(checksum, 'tokens hash');
      console.log('Seeded tokens collection.');
      await storeInRedis(redisClient, tokensJSON, checksum);
      console.log('Cached tokens in redis.');
      process.exit()
    })
  .catch(e=>console.log(e))

};

run()