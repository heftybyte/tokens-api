const Hash = require('object-hash');
const redisClient = require('../../server/boot/redisConnector');

module.exports = function(Token) {
  Token.validatesUniquenessOf('symbol');

  Token.getTokens = async(givenChecksum, cb) => {
    let err = null
    const { tokens, checksum } = await fetchTokens(givenChecksum).catch(e=>err=e)
    if (err) {
      return cb(err)
    }
    return cb(null, {tokens, checksum});
  };

  const fetchFromDB = async() => {
    const tokens = await Token.find();
    if (!tokens) {
      throw new Error('no tokens found');
    }
    const tokensJSON = tokens.map((token)=>token.toJSON());
    const checksum = Hash(tokensJSON);
    // store in redis for next time
    redisClient.set('tokenChecksum', checksum);
    redisClient.set('tokens', tokenString);
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
