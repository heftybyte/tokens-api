const request = require('request');
const async = require('async');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const basePath =  path.resolve(__dirname) + '/..'
const tokens = require(`${basePath}/data/tokens.json`);

const imageUrl = (url) => {
  return `https://files.coinmarketcap.com/static/img/coins/128x128/${url}.png`;
};

const writeFile = (fileNamePath, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(basePath + fileNamePath, data, err => {
      if (err) reject(err);

      resolve(data);
    })
  })
};

const downloadImage = (url) => {
  return new Promise((resolve, reject) => {
    request(imageUrl(url), {encoding: 'binary'}, (err, res, body) => {
      fs.writeFile(basePath + `/client/img/tokens/${url}.png`, body, 'binary', (err) => {
        if (err) reject(err);

        console.log(`Image downloaded and saved to ${basePath}/client/img/tokens/${url}.png`);
        resolve(url);
      })
    })
  });
};

const getRedditAcct = (html) => {
  const redditPath = html.split('https://www.reddit.com/r/')[1];

  return redditPath ? `https://www.reddit.com/r/${redditPath.split('.embed')[0]}` : null;
};

const saveSocialStats = (coin, coins) => {
  request(`https://coinmarketcap.com/currencies/${coin}/#social`, (err, res, body) => {
    const $ = cheerio.load(body);
    const sym = coins[coin].symbol;
    const website = $('.list-unstyled li span[title=Website] + a').prop('href');
    const twitterAccount = $('.twitter-timeline').prop('href');
    const redditAccount = getRedditAcct(body);

    Object.assign(tokens[sym], {website, twitterAccount, redditAccount});

    fs.writeFile(basePath + `/data/tokens.json`, JSON.stringify(tokens, null, 4), (err) => {
      if (err) throw err;

      console.log('tokens.json file updated');
    })
  })
};

const saveCoinsById = (data) => {
  const res = {};

  data.forEach((obj) => {
    let {id, name, symbol, market_cap_usd, available_supply, total_supply, max_supply} = obj;

    res[id] = {
      id,
      name,
      symbol,
      market_cap_usd,
      available_supply,
      total_supply,
      max_supply
    }
  });

  return writeFile('/data/coins-by-id.json', JSON.stringify(res, null, 4));
};

request('https://api.coinmarketcap.com/v1/ticker/', (err, res, body) => {
  if (!err && body) {
    writeFile('/data/ticker.json', body)
      .then(body => {
        console.log(`ticker.json created and saved at ${basePath}/data/ticker.json`);

        saveCoinsById(JSON.parse(body)).then(body => {
          console.log(`coins-by-id.json created and saved at ${basePath}/data/coins-by-id.json`);

          const coinsById = JSON.parse(body);
          const urls = [];

          for (let coin in coinsById) {
            if (coinsById.hasOwnProperty(coin) && Object.keys(tokens).includes(coinsById[coin].symbol)) {
              urls.push(coinsById[coin].id)
            }
          }

          async.each(urls, (url) => {
            downloadImage(url)
              .then(coin => saveSocialStats(coin, coinsById))
              .catch(err => { throw err; });
          }, (err) => { throw err; })
        }).catch(ex => { throw ex; });

        console.log('All done')
      })
      .catch(err => {
        throw err;
      })
  }
});


