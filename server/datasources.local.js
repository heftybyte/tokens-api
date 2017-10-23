module.exports = {
  'db': {
    'name': 'db',
    'connector': 'memory',
  },
  'arangodbDs': {
    'host': process.env.DB_HOST || 'localhost',
    'port': process.env.DB_PORT || '8529',
    'database': process.env.DB_DATABASE || 'tokens-api',
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'root',
    'name': 'arangodbDs',
    'connector': 'loopback-connector-arangodb',
  },
};
