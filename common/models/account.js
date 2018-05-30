import uuidv4 from 'uuid/v4'
import {
  getAllTokenBalances,
  getTokenBalance,
  getContractAddress,
  getPriceForSymbol,
  getEthAddressBalance,
  getTopNTokens,
  getTokenPrices,
  getTokensBySymbol,
  TOKEN_CONTRACTS
} from '../../lib/eth.js';
import { all } from '../../lib/async-promise';
import firebaseAdmin from '../../lib/firebaseAdmin'
const app = require('../../server/server');
const _ = require('lodash')
const constants = require('../../constants/');
const TOP_N = 100
import { measureMetric } from '../../lib/statsd';
const axios = require('axios')
import web3 from '../../lib/web3'
import { generateTwoFactorKey, verifyTwoFactorToken } from '../../lib/two-factor-auth';

const INVITE_ENABLED = true
const DEFAULT_MAX_TTL = 31556926; // 1 year in seconds

const defaultPriceData = {
  price: 0,
  change: 0,
  marketCap: 0,
  volume24Hr: 0,
  period: '24h'
};

const featuredTokens = [
  'OMG', 'TNT', 'GNT', 'SNT', 'BAT'
].reverse();

const mapPrice = (priceMap, symbol) => {
  const priceData = priceMap[symbol] && priceMap[symbol]['USD'] ?
    priceMap[symbol]['USD'] : defaultPriceData
  return {
    price: priceData.price,
    change: priceData.change_pct_24_hr,
    marketCap: priceData.market_cap,
    volume24Hr: priceData.volume_24_hr,
    period: '24h',
    supply: priceData.supply
  }
}

module.exports = function(Account) {

  Account.register = async (data, cb) => {

    //metric timing
    const start_time = new Date().getTime();

    let err = null, Invite = app.default.models.Invite;

    const invite = INVITE_ENABLED &&
      await Invite.findOne({where: {invite_code: data.invite_code}}).catch(e=>err=e)

    if (err){

      // metrics
      measureMetric(constants.METRICS.register.failed, start_time);

      console.log('An error is reported from Invite.findOne: %j', err)
      err = new Error(err.message);
      err.status = 400;
      return cb(err);
    }

    // if (!invite && INVITE_ENABLED) {

    //   // metrics
    //   measureMetric(constants.METRICS.register.invalid_code, start_time);

    //   err = new Error("You need a valid invitation code to register.\nTweet @tokens_express to get one.");
    //   err.statusCode = 400;
    //   return cb(err);
    // } else

    if (!invite || !invite.claimed || !INVITE_ENABLED) {

      // metrics
      measureMetric(constants.METRICS.register.success, start_time);
      const accountData = {
        username: data.username,
        password: data.password,
        email: data.email,
        invite_code: data.invite_code
      }

      if (data.withGoogle) {
        accountData.password = uuidv4()
        accountData.google = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          serverAuthCode: data.serverAuthCode
        }
      }
      const instance = await Account.create(accountData).catch(e=>err=e)
      if (err) {
        err = new Error(err.message);
        err.status = 400;
        return cb(err);
      }
      if (invite && INVITE_ENABLED) {
        invite.claimed = true
        await invite.save().catch(e=>err=e)
        if (err) {
          console.log('unable to update claimed invite: %j', err)
        }
      }
      return cb(null, instance);
    } else {

      // metrics
      measureMetric(constants.METRICS.register.claimed, start_time);

      err = new Error("This invite has already been claimed.\nTweet @tokens_express to get a new one.");
      err.statusCode = 400;
      return cb(err);
    }
  };

  Account.prototype.addToWatchList = async function (data, cb) {
    const { symbol } = data

    let { err, token } = await getTokenBySymbol(symbol);
    if (err) {
      cb(err)
      return err
    }

    if(_.includes(this.watchList, token.symbol)) {
      err = new Error('This symbol  has already been added to this user account')
      err.status = 422
      cb(err)
      return err
    }


    this.watchList.push(token.symbol)

    const account = await this.updateAttribute('watchList', this.watchList).catch(e=>{err=e})

    if (err) {
      cb(err);
      return err
    }
    return cb(null, account)
  };

  Account.prototype.removeFromWatchList = async function (symbol, cb) {
    let watchList = this.watchList
    let err

    if(!_.includes(watchList, symbol)){
      err = new Error('This symbol does not exist for user account')
      err.status = 422
      cb(err)
      return err
    }

    watchList = _.remove(watchList, (n) => {
      return n !== symbol;
    });

    const account = await this.updateAttribute('watchList', watchList).catch(e=>{err=e})

    if (err) {
      cb(err);
      return err
    }
    return cb(null, account)


  }

  Account.prototype.addAddress = async function (data, cb) {
    //metric timing
    const start_time = new Date().getTime();

    let { address, platform='ethereum', name } = data;  // default to ethereum until new client release
    address = address.toLowerCase();
    let err = null
    if (!web3.utils.isAddress(address)) {
      // metrics
      measureMetric(constants.METRICS.add_address.invalid_address, start_time);

      err = new Error('Invalid ethereum address')
      err.status = 400
      cb(err)
      return err
    } else if (this.addresses.find((addressObj)=> addressObj.id.toLowerCase() === address) ) {
      err = new Error('This address has already been added to this user account')
      err.status = 422
      cb(err)
      return err
    }
    const { newAddressQueue } = app.default.queues.address
    await newAddressQueue.add({ address, userId: this.id, platform }, { jobId: uuidv4() }).catch(e=>err=e)
    if (err) {
      cb(err);
      return err
    }
    this.addresses.push({ id: address, platform, name })
    let account = await this.save().catch(e=>err=e)
    if (err) {
      err.status = 500
      cb(err);
      return err
    }
    // metrics
    measureMetric(constants.METRICS.add_address.success, start_time);
    cb(null, account)
    return account
  }

  Account.prototype.refreshAddress = async function (address, cb=()=>{}) {
    //metric timing
    const start_time = new Date().getTime();

    let err = null
    address = address.toLowerCase();

    if (!web3.utils.isAddress(address)) {
      // metrics
      measureMetric(constants.METRICS.add_address.invalid_address, start_time);
      err = new Error('Invalid ethereum address')
      err.status = 400
      cb(err)
      return err
    }
    const { backfillBalanceQueue } = app.default.queues.address
    await backfillBalanceQueue.add({ address, userId: this.id, days: 1 }, { jobId: uuidv4() }).catch(e=>err=e)
    if (err) {
      // metrics
      measureMetric(constants.METRICS.refresh_address.failed, start_time);
      cb(err)
      return err
    }
    // metrics
    measureMetric(constants.METRICS.refresh_address.success, start_time);
    cb(null)
    return
  }

  Account.prototype.deleteAddress = async function (address, cb) {
    address = address.toLowerCase();

    //metric timing
    const start_time = new Date().getTime();

    let { err, account } = await getAccount(this.id)
    if (err) {
      cb(err)
      return err
    }

    const addressIndex = account.addresses.findIndex(addressObj=>addressObj.id.toLowerCase() === address)

    if (addressIndex === -1) {

      // metrics
      measureMetric(constants.METRICS.delete_address.failed, start_time);

      err = new Error(`The address ${address} is not associated with the specified user account`)
      err.status = 404
      cb(err)
      return err
    }

    account.addresses.splice(addressIndex, 1)
    await account.save().catch(e=>err=e)
    if (err) {

      // metrics
      measureMetric(constants.METRICS.delete_address.failed, start_time);

      err = new Error('Could not update account')
      err.status = 500
      console.log(err)
      cb(err)
      return err
    }

    // metrics'
    measureMetric(constants.METRICS.delete_address.success, start_time);

    cb(null, account)
    return account
  }

  Account.prototype.addWallet = async function (data, cb) {
    let { address, platform='ethereum', name } = data // default to ethereum until new client release
    let err = null

    address = address.toLowerCase()

    if (!web3.utils.isAddress(address)) {
      err = new Error('Invalid ethereum address')
      err.status = 400
      cb(err)
      return err
    } else if (this.wallets.find((addressObj)=> addressObj.id.toLowerCase() === address) ) {
      err = new Error('This address has already been added to this user\'s wallet')
      err.status = 422
      cb(err)
      return err
    }
    const { newAddressQueue } = app.default.queues.address
    await newAddressQueue.add({ address, userId: this.id, platform }, { jobId: uuidv4() }).catch(e=>err=e)
    if (err) {
      cb(err);
      return err
    }
    this.wallets.push({id: address, platform, name})
    let account = await this.save().catch(e=>err=e)

    if (err) {
      err.status = 500
      cb(err);
      return err
    }

    cb(null, account)
    return account
  }

  Account.prototype.deleteWallet = async function (wallet, cb) {
    const address = wallet.toLowerCase();

    let { err, account } = await getAccount(this.id)

    if (err) {
      cb(err)
      return err
    }

    const addressIndex = account.wallets.findIndex(addressObj=>addressObj.id.toLowerCase() === address)

    if (addressIndex === -1) {
      err = new Error(`The address ${address} is not in the user\'s wallet`)
      err.status = 404
      cb(err)
      return err
    }

    account.wallets.splice(addressIndex, 1)
    await account.save().catch(e=>err=e)

    if (err) {
      err = new Error('Could not update account')
      err.status = 500
      console.log(err)
      cb(err)
      return err
    }

    cb(null, account)
    return account
  }

  Account.prototype.addExchangeAccount = async function (data, cb) {
    const { key, secret, name, passphrase, platform } = data
    const exists = this.exchangeAccounts.find((acct)=>{
      return acct.key.toLowerCase() === key.toLowerCase() &&
        acct.platform === platform
    })
    if (exists) {
      const err = new Error('This exchange account has already been added for this user')
      err.status = 422
      cb(err)
      return err
    }

    this.exchangeAccounts.push({ id: uuidv4(), key, secret, name, passphrase, platform })
    
    try {
      let account = await this.save()
      cb(null, account)
      return Promise.resolve(account)
    } catch (err) {
      err.status = 500
      console.error(err)
      cb(err);
      return Promise.reject(err)
    }
  }

  Account.prototype.deleteExchangeAccount = async function (id, cb) {
    let { err, account } = await getAccount(this.id)

    if (err) {
      cb(err)
      return err
    }

    const acctIndex = account.exchangeAccounts.findIndex(acct=>acct.id === id)

    if (acctIndex === -1) {
      err = new Error(`The account ${id} does not belong to the user`)
      err.status = 404
      cb(err)
      return err
    }

    account.exchangeAccounts.splice(acctIndex, 1)
    await account.save().catch(e=>err=e)

    if (err) {
      err = new Error('Could not update account')
      err.status = 500
      console.log(err)
      cb(err)
      return err
    }

    cb(null, account)
    return account
  }

  async function getTokenList(symbols=[], currency='USD') {
    const queries = {
      priceMap: app.default.models.Ticker.currentPrices(symbols.join(','), currency),
      tokens: getTokensBySymbol(symbols)
    }
    const { priceMap, tokens } = await all(queries)
    const prices = symbols.map(mapPrice.bind(null, priceMap))
    return tokens.map((token, i)=>({
      ...token,
      ...prices[i],
      symbol: symbols[i]
    }))
  }

  async function calculatePortfolio({account, addresses=[]}) {
    const addressList = addresses.map(a=>a.id).join(',')
    const balances = addresses.length ? await app.default.models.Balance.getBalances(addressList) : []
    const currencyPreference = account.preference.currency
    const symbols = Object.keys(balances)
    const priceMap  = await app.default.models.Ticker.currentPrices(symbols.join(','), currencyPreference)
    const prices = symbols.map(mapPrice.bind(null, priceMap))
    const tokens = symbols.map((symbol, i)=>({
      symbol: symbol,
      balance: balances[symbol] || 0,
      ...TOKEN_CONTRACTS[symbol],
      ...prices[i],
      priceChange: getPriceChange({...prices[i], balance: balances[symbol] || 0 }),
      priceChange7d: getPriceChange({price: prices[i].price, change: prices[i].change7d, balance: balances[symbol] || 0})
    })).sort((a,b)=>Math.abs(a.priceChange) > Math.abs(b.priceChange) ? -1 : 1)
    const totalValue = tokens.reduce(
      (acc, curr) => acc += (curr.price * curr.balance), 0);
    const totalPriceChange = tokens.reduce(
      (acc, curr) => acc + (curr.priceChange), 0)
    const totalPriceChange7d = tokens.reduce(
      (acc, curr) => acc + (curr.priceChange7d), 0)
    const totalPriceChangePct = (1-totalValue/(totalValue+totalPriceChange))*100
    const totalPriceChangePct7d = (1-totalValue/(totalValue+totalPriceChange7d))*100
    return {
      tokens,
      totalValue,
      totalPriceChange,
      totalPriceChangePct,
      totalPriceChange7d,
      totalPriceChangePct7d,
      top: []
    }
  }

  async function calculatePortfolioChart({period='1m', addresses}) {
    const addressList = addresses.map(a=>a.id).join(',')
    const balances = !addressList ? {} : await app.default.models.Balance.getBalances(addressList)
    const symbols = Object.keys(balances)
    if (!symbols.length) {
      return []
    }
    const ticker = await app.default.models.Ticker.historicalPrices(
      symbols.join(','), 'USD', 0, 0, 'chart', period, periodInterval[period] || '1d'
    )
    if (!Object.keys(ticker).length) {
      return []
    }
    const tsym = 'USD'
    const chartData = []
    const numBuckets = ticker[symbols[0]][tsym].length

    for (let i = 0; i < numBuckets; i++) {
      const time = ticker[symbols[0]][tsym][i].x
      const aggregatePrice = symbols.reduce((acc, symbol)=>{
        const point = ticker[symbol][tsym][i] || { y: 0 }
        return acc + (balances[symbol] * point.y)
      }, 0)
      const aggregateChange = symbols.reduce((acc, symbol)=>{
        const point = ticker[symbol][tsym][i] || { y: 0 }
        return acc + (balances[symbol] * point.change_close)
      }, 0)
      const aggregatePrevPrice = aggregatePrice - aggregateChange
      chartData.push({
        x: time,
        y: aggregatePrice,
        change_close: aggregateChange,
        change_pct: aggregatePrice > aggregatePrevPrice ?
          ((1/(aggregatePrevPrice / aggregatePrice))-1)*100 :
          (aggregatePrice / aggregatePrevPrice) - 1
      })
    }
    return chartData
  };

  const getAccount = async (id) => {
    let err = null
    const account = await Account.findById(id).catch(e=>{err=e})

    if (!err && !account) {
      err = new Error("Account not found")
      err.status = 404
    }

    return {
      account,
      err
    }
  }

  const getTokenBySymbol = async (symbol) => {
    let err = null
    const Token = app.default.models.Token;
    const token = await Token.findOne({where: {symbol}}).catch(e=>{err=e})

    if (!err && !token) {
      err = new Error("Token not found")
      err.status = 404
    }

    return {
      token,
      err
    }
  }

  const aggregateTokens = (addresses) => {
    const uniqueTokens = {}
    let totalEther = 0
    addresses.forEach((addressObj)=>{
      totalEther += addressObj.ether || 0
      addressObj.tokens.forEach((token)=>{
        if (!uniqueTokens[token.symbol]) {
          uniqueTokens[token.symbol] = token
        } else {
          uniqueTokens[token.symbol].balance += token.balance
        }
      })
    })
    const symbols = Object.keys(uniqueTokens)
    if (totalEther) {
      uniqueTokens['ETH'] = { balance: totalEther, symbol: 'ETH' }
      symbols.unshift('ETH')
    }
    const tokens = symbols.map((symbol)=>uniqueTokens[symbol])
    return { symbols, tokens }
  };

  const AccountTypes = {
    'address': 'addresses',
    'wallet': 'wallets',
    'exchange-account': 'exchangeAccounts'
  }
  
  function verifyAccountOwner(owner={}, accountId, type) {
    const accountType = AccountTypes[type]
    const accounts = owner[accountType] || []
    if (!accounts.find(a=>a.id.toLowerCase()===accountId.toLowerCase())) {
      const err = new Error('Unauthorized Access')
      err.status = 401
      throw err
    }
    return true
  }

  Account.prototype.getPortfolio = async function (type, accountId, cb) {
    try {
      const account = await Account.findById(this.id);
      verifyAccountOwner(account, accountId, type);
      const portfolio = await calculatePortfolio({
        account,
        addresses: [{ id: accountId }]
      });
      cb && cb(null, portfolio)
      return Promise.resolve(portfolio)
    } catch (err) {
      console.error(err)
      cb && cb(err)
      return Promise.reject(err)
    }
  };

  Account.prototype.getPortfolioChart = async function (type, accountId, period, cb) {
    try {
      const account = await Account.findById(this.id);
      verifyAccountOwner(account, accountId, type);
      const chartData = await calculatePortfolioChart({
        addresses: [{ id: accountId }],
        period
      });
      cb && cb(null, chartData)
      return Promise.resolve(chartData)
    } catch (err) {
      console.error(err)
      cb && cb(err)
      return Promise.reject(err)
    }
  };

  Account.prototype.getEntirePortfolio = async function (cb) {
    try {
      const account = await Account.findById(this.id);
      const { portfolio={}, watchList=[], featured=[] } = await all({
        portfolio: calculatePortfolio({
          account,
          addresses: [...account.addresses, ...account.wallets],
        }),
        watchList: getTokenList(account.watchList),
        featured: getTokenList(featuredTokens)
      })
      cb && cb(null, { ...portfolio, watchList, featured })
      return Promise.resolve(portfolio)
    } catch (err) {
      // metrics
      cb && cb(err)
      return Promise.reject(err)
    }
  };

  Account.prototype.getEntirePortfolioChart = async function (period, cb) {
    try {
      const account = await Account.findById(this.id);
      const chartData = await calculatePortfolioChart({
        addresses: [...account.addresses, ...account.wallets],
        period
      });
      cb && cb(null, chartData)
    } catch (err) {
      cb && cb(err)
      return Promise.reject(err)
    }
  };

  Account.prototype.getFirebaseAuthToken = async function (cb) {
    try {
      const account = await Account.findById(this.id)
      const claims = {
        id: this.id,
        name: account.username,
        avatar: account.avatar
      }
      const token = await firebaseAdmin.auth().createCustomToken(this.id.toString(), claims)
      return cb(null, token)
    } catch(err) {
      console.log('err', err)
      return cb(err)
    }
  }

  const periodInterval = {
    '1d': '5m',
    '1w': '10m',
    '1m': '1d',
    '3m': '1d',
    '1y': '1w',
    'all': '1w'
  }

  const getPriceChange = ({price, balance, change}) => {
    const totalValue = price * (balance || 1)
    const prevTotalValue = totalValue / ((100+change)/100)
    const priceChange = totalValue - prevTotalValue
    return priceChange || 0
  }

  Account.prototype.getTokenMeta = async function (sym, cb) {
    let { err, account } = await getAccount(this.id)
    if (err) {
      return cb(err)
    }

    const symbol = sym.toUpperCase()
    const balances = await app.default.models.Balance.getBalances(this.addresses.map(a=>a.id).join(',')).catch(e=>err=e)
    if (err) {
      cb && cb(err)
      return err
    }
    const priceData = await app.default.models.Ticker.currentPrice(symbol, 'USD').catch(e=>err=e)
    const { price, market_cap, volume_24_hr, change_pct_24_hr, supply } = (priceData && priceData[symbol]['USD']) ? priceData[symbol]['USD'] : {}
    let balance = balances[symbol]
    let totalValue = balance * price
    const priceChange = getPriceChange({price, balance, change: change_pct_24_hr})
    const priceChange7d = 0
    const { website, reddit, twitter, name, videoUrl, id } = TOKEN_CONTRACTS[symbol] || {}
    return cb(null, {
      ...(TOKEN_CONTRACTS[symbol] || {}),
      price,
      balance,
      totalValue,
      marketCap: market_cap,
      volume24Hr: volume_24_hr,
      change: change_pct_24_hr,
      priceChange,
      priceChange7d,
      supply,
      symbol
    });
  };

  Account.addNotificationToken = async function (req, data, cb) {
    const start_time = new Date().getTime();
    const { token } = data
    let {account, err} = await getAccount(req.accessToken.userId);

    if (err) {
      // metrics
      measureMetric(constants.METRICS.add_notification.failed, start_time);
      return cb(err);
    }

    let notificationTokens = account.notification_tokens;
    if(!_.includes(notificationTokens, token)){
      notificationTokens.push(token)
      const newAccount = await account.updateAttribute('notification_tokens', notificationTokens).catch(e=>{err=e})

      if (err) {
        // metrics
        measureMetric(constants.METRICS.add_notification.failed, start_time);
        return cb(err);
      }

      return cb(null, newAccount)
    }
    return cb(null, account)
  }

  Account.prototype.currencyPreference = async function(data, cb) {
    const validCurrencies = [
      "ETH", "BTC", "AUD", "CNY", "EUR", "JPY", "KRW", "USD"
    ]
    let currency = data.toUpperCase()
    let { err, account } = await getAccount(this.id)

    if (err) {
      return cb(err)
    }

    if (!validCurrencies.includes(currency)) {
      err = new Error(`Currency must be one of the following: ${validCurrencies}`)
      return cb(err)
    }

    account.preference.currency = currency
    await account.save().catch(e=>err=e)

    if (err) {
      err = new Error('Could not update account preference')
      err.status = 500
      cb(err)
      return err
    }

    cb(null, account)
    return account
  }

  Account.prototype.changeUniqueField = async function (field, value) {
    try {
      if (!['email', 'username'].includes(field)) {
        const err = new Error('Forbidden field change')
        err.status = 403
        throw err
      }

      const account = await Account.findById(this.id)
      const duplicate = await Account.findOne({ where: { [field]: value }})

      if (duplicate) {
        const err = new Error(`This ${field} already exists`)
        err.status = 400
        throw err
      }
      
      const result = await account.updateAttribute(field, value)
      return Promise.resolve(result)
    } catch (err) {
      console.error(err)
      return Promise.reject(err)
    }
  }

  Account.prototype.update = async function (data, cb) {
    console.log({data})
    const { email, username, password, description } = data
    const tasks = []

    if (email) {
      tasks.push(this.changeUniqueField('email', email))
    }

    if (username) {
      tasks.push(this.changeUniqueField('username', username))
    }

    if (password) {
      tasks.push(this.updateAttribute('password', Account.app.models.User.hashPassword(password)))
    }

    if (description) {
      tasks.push(this.updateAttribute('description', description))
    }

    try {
      await Promise.all(tasks)
      const account = await Account.findById(this.id)
      cb(null, account)
      return Promise.resolve(account)
    } catch (err) {
      console.log(err)
      cb(err)
      return Promise.reject(err)
    }
  }

  Account.prototype.setTwoFactorAuthSecret = async function(cb){
    try {
      const account = await Account.findById(this.id)
      const authSecret = await generateTwoFactorKey()
      const result = await account.updateAttributes({
        'two_factor_secret': authSecret,
        'two_factor_enabled': false // auth shouldn't be required until new secret is confirmed
      })
      return cb(null, account)
    } catch (err) {
      console.log('setTwoFactorAuthSecret', err)
      return cb(err)
    }
  }

  Account.prototype.disableTwoFactorAuth = async function(cb){
    try {
      const account = await Account.findById(this.id)
      const result = await account.updateAttributes({
        'two_factor_secret': '',
        'two_factor_enabled': false
      })
      return cb(null, account)
    } catch (err) {
      console.log('setTwoFactorAuthSecret', err)
      return cb(err)
    }
  }

  Account.verifyTwoFactorToken = async function(data, cb){
    try {
      const { id, token, confirm, login } = data
      const account = await Account.findById(id)
      let result = await verifyTwoFactorToken(token, account.two_factor_secret)
      if (!result){
        const err = new Error('Invalid auth token')
        err.status = 401
        throw err
      } else if (confirm) {
        result = await account.updateAttribute('two_factor_enabled', true)
      } else if (login) {
        result = await createAccessToken(account)
      }
      cb(null, result)
      return Promise.resolve(result)
    } catch (err) {
        console.log(err)
        cb(err)
        return Promise.reject(err)
    }
  }

  Account.logout = async function(accessToken, data, fn) {
    fn = fn || utils.createPromiseCallback();
    let tokenId = accessToken && accessToken.id
    const { notification_token } = data

    if (!tokenId) {
      const err = new Error('accessToken is required to logout');
      err.status = 401;
      process.nextTick(fn, err);
      return fn.promise;
    }

    if (!notification_token) {
      const err = new Error('Notification Token is required to logout');
      err.status = 401;
      process.nextTick(fn, err);
      return fn.promise;
    }

    let {account, err} = await getAccount(accessToken.userId)

    if(err){
      return fn(err);
    }

    let notificationTokens = account.notification_tokens;
    notificationTokens = notificationTokens.filter((e) => e !== notification_token)

    account.updateAttribute('notification_tokens', notificationTokens).catch(e=>{err=e})

    if(err){
      return fn(err);
    }

    const info = this.relations.accessTokens.modelTo.destroyById(tokenId).catch(e=>{err=e})

    if (err) {
      fn(err);
    } else if ('count' in info && info.count === 0) {
      err = new Error('Could not find accessToken');
      err.status = 401;
      fn(err);
    } else {
      fn();
    }

    return fn.promise;
  };

  async function createAccessToken(account) {
    try {
      const token = await account.createAccessToken(DEFAULT_MAX_TTL)
      token.__data.user = account;
      return token
    } catch (err) {
      console.error('createAccessToken', account.username, err)
      throw err
    }
  }

  const login = Account.login
  Account.login = async (credentials, include='user', fn) => {
    if (typeof include === 'function') {
      fn = include;
      include = undefined;
    }
    try {
      const token = await login.call(Account, credentials, include)
      const { user } = token.toJSON()
      if (user.two_factor_enabled) {
        const res = { userId: user.id, twoFactorRequired: true }
        fn(null, res)
        return Promise.resolve(res)
      } else {
        fn(null, token) // normal login
        return Promise.resolve(token)
      }
    } catch (err) {
      console.error('login', err)
      fn(err)
      return Promise.reject(err)
    }
  }

  Account.googleSignIn = async (data, cb) => {
    try {
      const userInfo = await axios({ 
        method: 'GET',
        url: 'https://www.googleapis.com/userinfo/v2/me',
        headers: { 
          Authorization: `Bearer ${data.accessToken}`
        }
      })
      const account = await Account.findOne({where: {email: userInfo.data.email}})

      if (!account) {
        const err = new Error('Account not found')
        err.status = 404
        throw err
      } else if (account.email !== userInfo.data.email) {
        const err = new Error('Unauthorized access attempt')
        err.status = 401
        throw err
      }
      
      let token
      if (account.two_factor_enabled) {
        token = { userId: account.id, twoFactorRequired: true }
      } else {
        token = await createAccessToken(account)
      }
      return cb(null, token)
    } catch (err) {
      console.error('googleSignIn err', err)
      return cb(err)
    }
  }

  Account.validatesLengthOf('password', {min: 5, message: {min: 'Password should be at least 5 characters'}});

  Account.afterRemoteError('prototype.login', function(ctx, next) {
    const start_time = new Date().getTime() - 10;
    measureMetric(constants.METRICS.login.failed, (start_time));
  });

  Account.on('resetPasswordRequest', function(info) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const url = `${appUrl}/reset-password`;
    const html =`Click <a href="${url}?access_token=${info.accessToken.id}">here</a> to reset your password`;

    Account.app.models.Email.send({
      to: info.email,
      from: 'no-reply@tokens.express',
      subject: 'Password reset',
      text: `Please copy the url below into your browser to reset your password.\n ${url}?access_token=${info.accessToken.id}`,
      html: html
    }, function(err) {
      if (err) return console.log(err['response']['body']['errors'], '> error sending password reset email');
      console.log('> sending password reset email to:', info.email);
    });
  });

  Account.remoteMethod('logout', {
      description: 'Logout a user with access token.',
      accepts: [
        {arg: 'access_token', type: 'object', http: function(ctx) {
          let req = ctx && ctx.req;
          let accessToken = req && req.accessToken;
          //var tokenID = accessToken ? accessToken.id : undefined;

          return accessToken;
        }, description: 'Do not supply this argument, it is automatically extracted ' +
        'from request headers.',
        },
        {arg: 'data', type: 'object', http: { source: 'body'}, description: 'Notification Token'}
      ],
      http: {verb: 'all'},
    }
  );

  Account.remoteMethod('getTokenMeta', {
    isStatic: false,
    http: {
      path: '/portfolio/token/:symbol',
      verb: 'get'
    },
    accepts: {
      arg: 'symbol',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      root: true,
      type: 'account'
    },
    description: 'Shows metadata information details for a token'
  });

  Account.remoteMethod('addNotificationToken', {
    http: {
      path: '/push-token',
      verb: 'post'
    },
    accepts:[
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
      {arg: 'data', type: 'object', http: { source: 'body'}, description: 'token'}
    ],
    returns: {
      root: true,
    },
    description: 'Update User Notification token'
  });

  Account.remoteMethod('register', {
    http: {
      path: '/register',
      verb: 'post',
    },
    accepts: {
      arg: 'data',
      type: 'object',
      http: {
        source: 'body',
      },
      description: 'Ethereum address',
    },
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Registers a User\'s deviceId in the database',
  });

  Account.remoteMethod('googleSignIn', {
    http: {
      path: '/google-signin',
      verb: 'post',
    },
    accepts: {
      arg: 'data',
      type: 'object',
      http: {
        source: 'body',
      },
      description: 'Username and Google access token'
    },
    returns: {
      arg: 'accessToken',
      type: 'object',
      root: true
    },
    description: 'Sign a user in via Google auth',
  });

  Account.remoteMethod('addAddress', {
    isStatic: false,
    http: {
      path: '/address',
      verb: 'post',
    },
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: {
          source: 'body',
        },
        description: 'Ethereum address',
      }
    ],
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Add an ethereum address to a user\'s account',
  });

  Account.remoteMethod('addWallet', {
    isStatic: false,
    http: {
      path: '/wallets',
      verb: 'post'
    },
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: {
          source: 'body'
        }
      }
    ],
    returns: {
      root: true,
      type: 'account'
    },
    description: 'Add an ethereum address to a user\'s wallet'
  });

  Account.remoteMethod('deleteWallet', {
    isStatic: false,
    http: {
      path: '/wallets/:wallet',
      verb: 'delete',
    },
    accepts: {
      arg: 'wallet',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Delete an ethereum address from a user\'s wallet'
  });

  Account.remoteMethod('addExchangeAccount', {
    isStatic: false,
    http: {
      path: '/exchangeAccounts',
      verb: 'post'
    },
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: {
          source: 'body'
        }
      }
    ],
    returns: {
      root: true,
      type: 'account'
    },
    description: 'Add an 3rd party exchange account to a user\'s account'
  });

  Account.remoteMethod('deleteExchangeAccount', {
    isStatic: false,
    http: {
      path: '/exchangeAccounts/:id',
      verb: 'delete',
    },
    accepts: {
      arg: 'id',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Delete a 3rd party exchange account from the user'
  });

  Account.remoteMethod('refreshBalances', {
    isStatic: false,
    http: {
      path: '/wallets/refreshBalances',
      verb: 'get',
    },
    returns: {
      root: true,
    },
    description: ['Gets the total balance for the specified Ethereum Address ',
      'in the user\'s wallet ',
      'as well as its tokens, their respective prices, and balances'],
  });

  Account.remoteMethod('addToWatchList', {
    isStatic: false,
    http: {
      path: '/watch-list',
      verb: 'post',
    },
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: {
          source: 'body',
        },
        description: 'Watch List Symbol',
      }
    ],
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Add watchlist to a user\'s account',
  });

  Account.remoteMethod('removeFromWatchList', {
    isStatic: false,
    http: {
      path: '/watch-list/:symbol',
      verb: 'delete',
    },
    accepts: [
      {
        arg: 'symbol',
        type: 'string',
        http: {
          source: 'path'
        },
        description: 'symbol',
      }
    ],
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Delete a symbol from watchlist.',
  });

  Account.remoteMethod('refreshAddress', {
    isStatic: false,
    http: {
      path: '/address/:address/refresh',
      verb: 'post',
    },
    accepts: {
      arg: 'address',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      root: true,
    },
    description: ['Updates the total balance for the specified Ethereum Address ',
      'as well as tokens with non-zero balances'],
  });

  Account.remoteMethod('deleteAddress', {
    isStatic: false,
    http: {
      path: '/address/:address',
      verb: 'delete',
    },
    accepts: {
      arg: 'address',
      type: 'string',
      http: {
        source: 'path'
      }
    },
    returns: {
      "root": true,
      "type": "account"
    },
    description: 'Delete an ethereum address from a user\'s account'
  });

  Account.remoteMethod('currencyPreference', {
    isStatic: false,
    http: {
      path: '/preferences/currency/:currency',
      verb: 'post'
    },
    accepts: [{
      arg: 'currency',
      type: 'string',
      http: {
        source: 'path'
      },
      description: 'default currency for conversions'
    }],
    returns: {
      root: true
    },
    description: ['Sets the user\'s preferred currency']
  })

  Account.remoteMethod('getEntirePortfolio', {
    isStatic: false,
    http: {
      path: '/portfolio',
      verb: 'get',
    },
    returns: {
      root: true,
    },
    description: ['Gets the total balance for the specified Ethereum Address ',
      'as well as its tokens, their respective prices, and balances'],
  });

  Account.remoteMethod('getEntirePortfolioChart', {
    isStatic: false,
    http: {
      path: '/portfolio-chart',
      verb: 'get',
    },
    accepts: {
      arg: 'period',
      type: 'string',
      http: {
        source: 'query'
      }
    },
    returns: {
      root: true,
    },
    description: ['Gets the total balance across all ethereum addresses',
      'as well as its tokens, their respective prices, and balances'],
  });

  Account.remoteMethod('getPortfolio', {
    isStatic: false,
    http: {
      path: '/portfolio/:type/:accountId',
      verb: 'get',
    },
    accepts: [
      {
        arg: 'type',
        type: 'string',
        http: {
          source: 'path'
        },
        description: 'all|wallet|exchange|address',
      },
      {
        arg: 'accountId',
        type: 'string',
        http: {
          source: 'path'
        },
        description: 'individual account id',
      }
    ],
    returns: {
      root: true,
    },
    description: ['Gets the total balance for the specified account ',
      'as well as its tokens, their respective prices, and balances'],
  });

  Account.remoteMethod('getPortfolioChart', {
    isStatic: false,
    http: {
      path: '/portfolio-chart/:type/:accountId',
      verb: 'get',
    },
    accepts: [
      {
        arg: 'type',
        type: 'string',
        http: {
          source: 'path'
        },
        description: 'all|wallet|exchange|address',
      },
      {
        arg: 'accountId',
        type: 'string',
        http: {
          source: 'path'
        },
        description: 'individual account id',
      },
      {
        arg: 'period',
        type: 'string',
        http: {
          source: 'query'
        }
      }
    ],
    returns: {
      root: true,
    },
    description: ['Gets the total balance across all ethereum addresses',
      'as well as its tokens, their respective prices, and balances'],
  });

  Account.remoteMethod('changeEmail', {
    isStatic: false,
    http: {
      path: '/change-email',
      verb: 'post',
    },
    accepts: {
      arg: 'data',
      type: 'object',
      http: {
        source: 'body'
      },
      'description': 'Contains oldEmail, newEmail, password'
    },
    returns: {
      root: true,
    },
    description: ['Change Email adddress of a user'],
  });

  Account.remoteMethod('changeUsername', {
    isStatic: false,
    http: {
      path: '/change-username',
      verb: 'post',
    },
    accepts: [{
      arg: 'data',
      type: 'object',
      http: {
        source: 'body'
      },
      description: 'contains password and new username'
    }],
    returns: {
      root: true,
    },
    description: ['Change the username of a user'],
  });

  Account.remoteMethod('update', {
    isStatic: false,
    http: {
      path: '/update',
      verb: 'post',
    },
    accepts: [{
      arg: 'data',
      type: 'object',
      http: {
        source: 'body'
      },
      description: 'contains new profile info'
    }],
    returns: {
      root: true,
    },
    description: ['Change the details of a user'],
  });

  Account.remoteMethod('setTwoFactorAuthSecret', {
    isStatic: false,
    http: {
      path: '/two-factor/set',
      verb: 'post',
    },
    accepts: [],
    returns: {
      root: true,
    },
    description: ['Enable two factor auth'],
  });

  Account.remoteMethod('disableTwoFactorAuth', {
    isStatic: false,
    http: {
      path: '/two-factor/disable',
      verb: 'post',
    },
    accepts: [],
    returns: {
      root: true,
    },
    description: ['Enable two factor auth'],
  });

  Account.remoteMethod('verifyTwoFactorToken', {
    http: {
      path: '/two-factor/verify',
      verb: 'post',
    },
    accepts: [{
      arg: 'data',
      type: 'object',
      http: {
        source: 'body'
      },
      description: 'contains token'
    }],
    returns: {
      root: true,
    },
    description: ['Verify two factor token'],
  });

  Account.remoteMethod('getFirebaseAuthToken', {
    isStatic: false,
    http: {
      path: '/firebase-auth-token',
      verb: 'get',
    },
    returns: {
      root: true,
    },
    description: ['Generates an access token for firebase'],
  });
};
