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
  }
};
