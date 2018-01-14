module.exports = {
  'db': {
    'name': 'db',
    'connector': 'memory',
  },
  "mongodb": {
    "name": "mongodb",
    "host": process.env.MONGODB_HOST || 'localhost',
    "port": process.env.MONGODB_PORT || 27017,
    "database": process.env.MONGODB_DATABASE || "tokens-api",
    "password": process.env.MONGODB_PASSWORD || "",
    "user": process.env.MONGODB_USER || "",
    "connector": "mongodb"  
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
  'TickerApiService': {
    'name': 'TickerApiService',
    'connector': 'rest',
    'baseUrl': process.env.TICKER_API_URL || 'http://localhost:3003',
    'operations': [
      {
        'template': {
          'method': 'GET',
          'url': '/price/now',
          'query': {
            'fsym': '{^fsym:string}',
            'tsym': '{^tsym:string}'
          }
        },
        'functions': {
          'price/now': ['fsym', 'tsym'],
          'currentPrice': ['fsym', 'tsym']
        }
      },
      {
        'template': {
          'method': 'GET',
          'url': '/prices/now',
          'query': {
            'fsyms': '{^fsyms:string}',
            'tsyms': '{^tsyms:string}'
          }
        },
        'functions': {
          'prices/now': ['fsyms', 'tsyms'],
          'currentPrices': ['fsyms', 'tsyms']
        },
      },
      {
        'template': {
          'method': 'GET',
          'query': {
            'fsym': '{^fsym:string}',
            'tsym': '{^tsym:string}',
            'start': '{start:number}',
            'end': '{end:number}',
            'format': '{format:string}',
            'period': '{period:string}',
            'interval': '{interval:string}'
          },
          'url': '/price/historical'
        },
        'functions': {
          'price/historical': ['fsym', 'tsym', 'start', 'end', 'format', 'period', 'interval'],
          'historicalPrice': ['fsym', 'tsym', 'start', 'end', 'format', 'period', 'interval']
        }
      },
      {
        'template': {
          'method': 'GET',
          'query': {
            'fsyms': '{^fsyms:string}',
            'tsyms': '{^tsyms:string}',
            'start': '{start:number}',
            'end': '{end:number}',
            'format': '{format:string}',
            'period': '{period:string}',
            'interval': '{interval:string}'
          },
          'url': '/prices/historical'
        },
        'functions': {
          'prices/historical': ['fsyms', 'tsyms', 'start', 'end', 'format', 'period', 'interval'],
          'historicalPrices': ['fsyms', 'tsyms', 'start', 'end', 'format', 'period', 'interval']
        }
      }
    ]
  }
};
