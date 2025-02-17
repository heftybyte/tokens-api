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
    "connector": "mongodb",
    "normalizeUndefinedInQuery": "nullify"
  },
  'TickerApiService': {
    'name': 'TickerApiService',
    'connector': 'rest',
    'baseUrl': process.env.TICKER_API_URL || 'http://dev.local:8888/ticker',
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
  },
  'BalanceApiService': {
    'name': 'BalanceApiService',
    'connector': 'rest',
    'baseUrl': process.env.BALANCE_API_URL || 'http://dev.local:8888/balance',
    'operations': [
      {
        'template': {
          'method': 'GET',
          'url': '/',
          'query': {
            'addresses': '{^addresses:string}'
          }
        },
        'functions': {
          'balances': ['addresses'],
          'getBalances': ['addresses']
        }
      }
    ]
  },
  "sendgrid": {
    "connector": "loopback-connector-sendgrid",
    "api_key": process.env.SENDGRID_KEY || ''
  }
};
