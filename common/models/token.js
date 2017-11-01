const Hash = require('object-hash');
const redisClient = require('../../server/boot/redisConnector');
const TOKEN_CACHE_TTL = 30;

module.exports = function(Token) {
  Token.getTokens = async(checksum, cb) => {
    return cb(null, await fetchTokens(checksum));
  };

  const fetchFromDB = async() => {
    const tokens = await Token.find();
    const tokenString = JSON.stringify(tokens);
    const checksum = Hash(tokenString);
    // store in redis for next time
    redisClient.set('tokenChecksum', checksum, 'EX', TOKEN_CACHE_TTL);
    redisClient.set('tokens', tokenString, 'EX', TOKEN_CACHE_TTL);
    return {tokens, checksum};
  };

  const fetchTokens = async(checksum) => {
    const redisChecksum = await redisClient.getAsync('tokenChecksum');
    // if nothing is cached pull from db
    if (!redisChecksum) return await fetchFromDB();
    // if checksums match return didNotChange
    if (checksum && checksum === redisChecksum) return {didNotChange: true};
    // else return from redis
    const tokens = await redisClient.getAsync('tokens');
    return {tokens: JSON.parse(tokens), checksum: redisChecksum};
  };

  // marking checksum as required because for some weird reason it doesn't
  // get passed to the method if you do not.
  Token.remoteMethod('getTokens', {
    http: {
      path: '/',
      verb: 'get',
    },
    accepts: {
      arg: 'checksum',
      type: 'string',
      description: 'The hash of the currently available token data',
      required: true,
    },
    description: 'fetch all tokens and their checksum',
    returns: {
      root: true,
      type: 'array',
    },
  });

  Token.disableRemoteMethodByName('find');
};
