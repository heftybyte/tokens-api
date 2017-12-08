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
          'price/now': ['fsym', 'tsym']
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
          'prices/now': ['fsyms', 'tsyms']
        },
      },
      {
        'template': {
          'method': 'GET',
          'query': {
            'fsym': '{^fsym:string}',
            'tsym': '{^tsym:string}',
            'start': '{^start:number}',
            'end': '{^end:number}',
            'format': '{^format:string}'
          },
          'url': '/price/historical'
        },
        'functions': {
          'price/historical': ['fsym', 'tsym', 'start', 'end', 'format']
        }
      },
      {
        'template': {
          'method': 'GET',
          'query': {
            'fsyms': '{^fsyms:string}',
            'tsyms': '{^tsyms:string}',
            'start': '{^start:number}',
            'end': '{^end:number}',
            'format': '{^format:string}'
          },
          'url': '/prices/historical'
        },
        'functions': {
          'prices/historical': ['fsyms', 'tsyms', 'start', 'end', 'format']
        }
      }
    ]
  },
};
