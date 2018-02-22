// const { clientLogger }  = require('../../lib/logger');
// const { COIN_MARKETCAP, getAllPrices }  = require('../../lib/price');
// const TOKENS = require('../../data/tokens');
// const _ = require('lodash');
//
// module.exports = app => {
//   let router = app.loopback.Router();
//   app.post('/api/client-logs', (req, res) => {
//     console.log(req.body)
//     const {message, level} = req.body;
//     let allowedLevel = [
//       'debug',
//       'info',
//       'notice',
//       'warning',
//       'err',
//       'crit',
// 	    'alert',
// 	    'emerg',
//     ];
//
//     if (!_.includes(allowedLevel, level)) {
//       return res.status(401).json({message: 'Invalid Level'});
//     }
// 	  clientLogger(message, level);
//     return res.status(200).json({message: 'Log complete'});
//   });
//
//   app.get('/fetch-prices', async (req, res)=>{
//     try {
//       await getAllPrices('USD', COIN_MARKETCAP, false)
//       res.send(200)
//     } catch(e) {
//       console.log('fetch prices', e)
//       res.send(400)
//     }
//   })
//
//   app.get('/share/:symbol', (req, res)=>{
//     const symbol = req.params.symbol.toUpperCase()
//     const { name, description } = TOKENS[symbol]
//     const image = `https://api.tokens.express/img/tokens/${symbol.toLowerCase()}.png`
//     const url = `https://www.tokens.express`
//     const appLink = `tokensexpress://token/${symbol}`
//     const appName = 'Tokens Express'
//     const packageName = 'express.tokens.tokens'
//     const appStoreId = 0
//     const ogMeta = `
//     <meta property="og:url"               content="${url}" />
//     <meta property="og:type"              content="article" />
//     <meta property="og:title"             content="${name} - ${symbol}" />
//     <meta property="og:description"       content="${description}" />
//     <meta property="og:image"             content="${image}" />
//
//     <meta property="al:ios:app_store_id"  content="${appStoreId}" />
//     <meta property="al:ios:url"           content="${appLink}" />
//     <meta property="al:ios:app_name"      content="${appName}" />
//
//     <meta property="al:android:package"   content="${packageName}" />
//     <meta property="al:android:url"       content="${appLink}" />
//     <meta property="al:android:app_name"  content="${appName}" />
//     `
//     res.send(ogMeta)
//   })
//   app.use(router);
// };
