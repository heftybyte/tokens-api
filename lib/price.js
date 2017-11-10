// Required by the cryptocompare library
global.fetch = require('node-fetch');

const redisClient = require('../server/boot/redisConnector')
const cc = require('cryptocompare');
const _ = require('lodash');
const coinmarketcap = require('coinmarketcap');
const TOKEN_PRICE_IDS = require('../data/token-price-ids');
const TOKENS = require('../data/tokens')
const PRICE_CACHE_TTL = 30
const BlueBirdQueue = require('bluebird-queue');

export const COIN_MARKETCAP = 'coinmarketcap'
export const CRYPTO_COMPARE = 'cryptocompare'
export const SOURCES = [COIN_MARKETCAP, CRYPTO_COMPARE]

let fetchPricesFromExternal = {
  [COIN_MARKETCAP]: null,
  [CRYPTO_COMPARE]: null
}
let localPriceCache = {
  [COIN_MARKETCAP]: {
    prices: null,
    timeoutId: 0
  },
  [CRYPTO_COMPARE]: {
    prices: null,
    timeoutId: 0
  }
}

const defaultPriceData = {
  price: 0,
  change: 0,
  marketCap: 0,
  volume24Hr: 0,
  period: '24h'
}

export const getAllPrices = async (tsym, source) => {
  let prices, resolveFetchFromExternal, rejectFetchFromExternal, err
  if (!fetchPricesFromExternal[source]) {
    fetchPricesFromExternal[source] = new Promise((resolve, reject)=>{
      resolveFetchFromExternal = resolve
      rejectFetchFromExternal = reject
    })
    prices = await fetchPrices(tsym, source).catch(e=>err=e)
  } else {
    // Prevent multiple calls to external source from same process
    prices = await fetchPricesFromExternal[source].catch(e=>err=e)
  }

  if (err && rejectFetchFromExternal) {
    fetchPricesFromExternal[source] = null
    rejectFetchFromExternal(err)
    return Promise.reject(err)
  } else if (resolveFetchFromExternal) {
    // Allow other calls to continue
    fetchPricesFromExternal[source] = null
    resolveFetchFromExternal(prices)
  }
  return Promise.resolve(prices)
}

export const getPrice = async (fsym, tsym, source) => {
  let priceData
  let sourceIndex = SOURCES.indexOf(source)
  for (; sourceIndex !== -1 && sourceIndex < SOURCES.length; sourceIndex++) {
    const prices = await getAllPrices(tsym, SOURCES[sourceIndex])
    priceData = prices && prices[fsym]
    if (!priceData) {
      console.log(`price not found for ${fsym} to ${tsym} at ${source}, next source: ${SOURCES[sourceIndex+1]}`)
      continue
    }
  }
  return Promise.resolve(priceData || defaultPriceData);
};

const cachePricesLocally = (source, prices) => {
    const priceCache = localPriceCache[source]
    clearTimeout(priceCache.timeoutId)
    priceCache.prices = prices
    priceCache.timeoutId = setTimeout(()=>{
      priceCache.prices = null
    }, PRICE_CACHE_TTL*1000)
}

// Get prices from 3 tiers local cache, redis cache, external source
const fetchPrices = async (tsym, source) => {
  const priceCache = localPriceCache[source]
  if (priceCache.prices) {
    console.log(`from local cache ${source}`,  Object.keys(priceCache.prices).length)
    return priceCache.prices
  }

  let prices, err
  const reply = await redisClient.getAsync(`${source}_price_data`).catch(e=>err=e)
  if (err || !reply) {
    prices = await fetchPricesFromSource(tsym, source)
    console.log(`from ${source}`, Object.keys(prices).length, err)
  } else {
    prices = JSON.parse(reply);
    console.log(`from redis ${source}`, Object.keys(prices).length);
  }
  return prices
}

const fetchPricesFromSource = async (tsym, source) => {
  let err, prices
  console.log('fetchPricesFromSource', source)
  switch (source) {
    case COIN_MARKETCAP:
      prices = await getPricesFromCoinMarketCap(tsym).catch(e=>err=e)
      break;
    case CRYPTO_COMPARE:
      prices = await getPricsFromCryptoCompare(tsym).catch(e=>err=e)
      break;
    default:
      console.log(`${source} is not yet supported`)
  }

  if (err || !prices)  {
    console.log('fetchPricesFromSource error', err, prices)
    return null
  }
  cachePricesLocally(source, prices)
  redisClient.set(`${source}_price_data`, JSON.stringify(prices), 'EX', PRICE_CACHE_TTL);
  return prices
}

const getPricesFromCoinMarketCap = async (tsym) => {
    let err
    const prices = {}
    let currencies = await coinmarketcap.ticker({
      convert: tsym
    }).catch(e=>err=e)

    if (err) {
      console.log('getPricesFromCoinMarketCap error', err)
      throw err
    }
    currencies = currencies.filter(currency => TOKEN_PRICE_IDS[currency.id])
    currencies.forEach((currency) => {
      prices[currency.symbol] = {
        price: Number(currency['price_usd']) || null,
        change: Number(currency['percent_change_24h']) || null,
        period: '24h',
        marketCap: Number(currency['market_cap_usd']) || null,
        volume24Hr: Number(currency['24h_volume_usd']) || null
      }
    });
    return prices
}

const getPricsFromCryptoCompare = async (tsym) => {
  let err
  const batchSize = 50
  const prices = {}
  let symbols = Object.keys(TOKENS)
  const numBatches = Math.floor(symbols.length / batchSize)

  const queue = new BlueBirdQueue({
    concurrency: 10,
  });

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    if (batch.length) {
      queue.add(cc.priceFull(batch, tsym))
    } else {
      console.log('no symbols in batch', i)
    }
  }

  const results = await queue.start()
  const priceData = results.reduce((acc, curr)=>_.merge(acc, curr), {})
  symbols.forEach(symbol=>{
    if (!priceData[symbol] || !priceData[symbol][tsym]) {
      console.log('no price data for', symbol, priceData[symbol])
      return
    }
    const priceInfo = priceData[symbol][tsym]
    prices[symbol] = {
      price: Number(priceInfo['PRICE']) || null,
      change: Number(priceInfo['CHANGEPCT24HOUR']) || null,
      period: '24h',
      marketCap: Number(priceInfo['MKTCAP']) || null,
      volume24Hr: Number(priceInfo['VOLUME24HOUR']) || null
    }
  })
  return prices
}

const findDupeSymbols = (currencies) => {
  let currencyMap = {}
  currencies.forEach((currency)=>{
    if (!currencyMap[currency.symbol]) {
      currencyMap[currency.symbol] = [currency]
    } else {
      currencyMap[currency.symbol].push(currency)
    }
  })
  let dupeSymbols = Object.keys(currencyMap).filter((symbol)=>{
    return currencyMap[symbol].length > 1
  })
  let dupeCurrencies = dupeSymbols.map((symbol)=>{
    return currencyMap[symbol]
  })
  // Find non dupes
  // let dupeSymbolsMap = {}
  // dupeSymbols.forEach((symbol)=>dupeSymbolsMap[symbol]=1)
  // let nonDupes = currencies.filter((c)=>!dupeSymbolsMap[c.symbol]).map((c)=>c.id)

  return dupeCurrencies
}
