const redisClient = require('../server/boot/redisConnector');
const cc = require('cryptocompare');
const coinmarketcap = require('coinmarketcap');

const PRICE_CACHE_TTL = 30
export const COIN_MARKETCAP = 'coinmarketcap'
export const CRYPTO_COMPARE = 'cryptocompare'

let fetchPricesFromExternal
let localPriceCache
let localPriceCacheTimeoutId

const defaultPriceData = {
  price_usd: 0,
  percent_change_24h: 0,
  market_cap_usd: 0,
  '24h_volume_usd': 0
}

export const getPrice = async (fsym, tsym, source) => {
  let prices, resolveFetchFromExternal, rejectFetchFromExternal, err
  if (!fetchPricesFromExternal) {
    fetchPricesFromExternal = new Promise((resolve, reject)=>{
      resolveFetchFromExternal = resolve
      rejectFetchFromExternal = reject
    })
    prices = await fetchPrices(tsym, source).catch(e=>err=e)
  } else {
    // Prevent multiple calls to external source from same process
    prices = await fetchPricesFromExternal.catch(e=>err=e)
  }

  if (err && rejectFetchFromExternal) {
    rejectFetchFromExternal(err)
    fetchPricesFromExternal = null
  } else if (resolveFetchFromExternal) {
    // Allow other calls to continue
    fetchPricesFromExternal = null
    resolveFetchFromExternal(prices)
  }

  const priceData = (prices && prices[fsym]) || defaultPriceData
  return Promise.resolve({
    price: Number(priceData['price_usd']),
    change: Number(priceData['percent_change_24h']),
    period: '24h',
    marketCap: Number(priceData['market_cap_usd']),
    volume24Hr: Number(priceData['24h_volume_usd']),
  });
};

const cachePricesLocally = (prices) => {
    clearTimeout(localPriceCacheTimeoutId)
    localPriceCache = prices
    localPriceCacheTimeoutId = setTimeout(()=>{
      localPriceCache = null
    }, PRICE_CACHE_TTL*1000)
}

// Get prices from 3 tiers local cache, redis cache, external source
const fetchPrices = async (tsym, source) => {
  if (localPriceCache) {
    console.log('from local cache',  Object.keys(localPriceCache).length)
    return localPriceCache
  }

  let prices, err
  const reply = await redisClient.getAsync('price_data').catch(e=>err=e)
  if (err || !reply) {
    prices = await fetchPricesFromSource(tsym, source)
    console.log(`from ${source}`, Object.keys(prices).length)
  } else {
    prices = JSON.parse(reply);
    console.log('from redis', Object.keys(prices).length);
  }
  return prices
}

const fetchPricesFromSource = async (tsym, source) => {
  let err, prices

  if (source === COIN_MARKETCAP) {
    prices = await getPricesFromCoinMarketCap(tsym).catch(e=>err=e)
  } else {
    console.log(`${source} is not yet supported`)
  }

  if (err || !prices)  {
    console.log('fetchPricesFromSource error', err, prices)
    return null
  }
  cachePricesLocally(prices)
  redisClient.set('price_data', JSON.stringify(prices), 'EX', PRICE_CACHE_TTL);
  return prices
}

const getPricesFromCoinMarketCap = async (tsym) => {
    let err
    const prices = {}
    const symbols = await coinmarketcap.ticker({
      convert: tsym
    }).catch(e=>err=e)

    if (err) {
      console.log('getPricesFromCoinMarketCap error', err)
      throw err
    }

    symbols.forEach((item) => {
      prices[item.symbol] = item;
    });
    return prices
}

const getPriceForSymbolViaCC = (fsym, tsym) => {
  return cc.priceFull(fsym, tsym).then(price => {
    const symbol = fsym.toUpperCase();
    if (!price[symbol]) {
      return;
    }
    const priceData = price[symbol][tsym];

    return Promise.resolve({
      price: priceData['PRICE'],
      change: priceData['CHANGEPCT24HOUR'],
      period: '24h',
      marketCap: priceData['MKTCAP'],
      volume24Hr: priceData['VOLUME24HOUR'],
    });
  });
};