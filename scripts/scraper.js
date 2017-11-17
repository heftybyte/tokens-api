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

const saveTokensJsonFile = () => {
  fs.writeFile(basePath + `/data/tokens.json`, JSON.stringify(tokens, null, 2), (err) => {
    if (err) throw err;

    console.log('tokens.json file updated');
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
  const redditPath = html.split('oScript.src = "https://www.reddit.com/r/')[1];

  return redditPath ? `https://www.reddit.com/r/${redditPath.split('.embed')[0]}` : null;
};

const saveSocialStats = (coin, coins) => {
  request(`https://coinmarketcap.com/currencies/${coin}/#social`, (err, res, body) => {
    const $ = cheerio.load(body);
    const sym = coins[coin].symbol;
    const website = $('.list-unstyled li span[title=Website] + a').prop('href');
    const twitter = $('.twitter-timeline').prop('href');
    const reddit = getRedditAcct(body);
    const name = coins[coin].name
    const id = coins[coin].id
    Object.assign(tokens[sym], {website, twitter, reddit, name, id});

    saveTokensJsonFile();
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

const downloadCoinsAndImages = () => {
  request('https://api.coinmarketcap.com/v1/ticker/?limit=0', (err, res, body) => {
    if (err) {
      console.log(err)
    }
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
};

const updateTokens = () => {
  request('https://raw.githubusercontent.com/etherdelta/etherdelta.github.io/master/config/main.json', (err, res, body) => {
    const etherdeltaTokens = JSON.parse(body).tokens;
    const existingTokens = Object.keys(tokens);

    etherdeltaTokens.forEach(({addr, name, decimals}) => {
      if (existingTokens.includes(name)) return;

      tokens[name] = {address: addr, decimals};
    });

    saveTokensJsonFile();
  })
};

const showHelp = () => {
  console.log(`Usage: npm run scrape -- --<task>
  where task is one of downloadCoinsAndImages, help or updateTokens

  npm run scrape -- --downloadCoinsAndImages  Fetch images and coin data from coinmarketcap
  npm run scrape -- --updateTokens            Fetch and update token list using data from etherdelta github repo
  npm run scrape -- --help                    Show this help message`)
};

const start = (arg) => {
  switch (arg) {
    case '--downloadCoinsAndImages':
      downloadCoinsAndImages();
      break;
    case '--updateTokens':
      updateTokens();
      break
    case '--help':
      showHelp();
      break;
    default:
      showHelp();
  }
};

start(process.argv.slice(2)[0]);