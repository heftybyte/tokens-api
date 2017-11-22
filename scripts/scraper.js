const request = require('request');
const async = require('async');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const BlueBirdQueue = require('bluebird-queue');
const limit = require('simple-rate-limiter');

const basePath =  path.resolve(__dirname) + '/..'
const tokens = require(`${basePath}/data/tokens.json`);
const BLACKLIST = require(`${basePath}/data/token-id-blacklist.json`);

const queue = new BlueBirdQueue({concurrency: 10});

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

const saveTokensReversed = (tokens) => {
  const tokensReversed = {};

  for (let key in tokens) {
    if (tokens.hasOwnProperty(key) && key !== 'ETH') {
      tokensReversed[tokens[key].address] = key
    }
  }

  fs.writeFile(basePath + `/data/tokens-reversed.json`, JSON.stringify(tokensReversed, null, 2), (err) => {
    if (err) throw err;

    console.log('tokens-reversed.json file updated');
  })
};

const saveTokensJsonFile = () => {
  fs.writeFile(basePath + `/data/tokens.json`, JSON.stringify(tokens, null, 2), (err) => {
    if (err) throw err;

    saveTokensReversed(tokens);
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

const saveSocialStats = limit((coin, coins) => {
  request(`http://coinmarketcap.com/currencies/${coin}/#social`, (err, res, body) => {
    if (err) { throw err; }

    const $ = cheerio.load(body);
    const sym = coins[coin].symbol;
    const website = $('.list-unstyled li span[title=Website] + a').prop('href');
    const twitter = $('.twitter-timeline').prop('href');
    const reddit = getRedditAcct(body);
    const name = coins[coin].name
    const id = coins[coin].id
    Object.assign(tokens[sym], {website, twitter, reddit, name, id});
  });
}).to(10).per(1000);

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
              if (coinsById.hasOwnProperty(coin) &&
                tokens[coinsById[coin].symbol] &&
                !BLACKLIST[coinsById[coin].id]) {
                urls.push(coinsById[coin].id)
              }
            }

            urls.forEach(url => {
              saveSocialStats(url, coinsById)
              queue.add(downloadImage(url))
            })

            queue.start().then(() => { saveTokensJsonFile(); })
          }).catch(ex => { throw ex; });

          console.log('All done')
        })
        .catch(err => {
          throw err;
        })
    }
  });
};

const saveTokenDescription = (token) => {
  return new Promise((resolve, reject) => {
    request(`https://raw.githubusercontent.com/etherdelta/etherdelta.github.io/master/tokenGuides/${token}.ejs`, (err, res, body) => {
      if (err) reject(err);

      const $ = cheerio.load(body);
      const description = $('p').first().text();

      tokens[token].description = description

      resolve(description);
    })
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

    for (let key in tokens) {
      queue.add(saveTokenDescription(key));
    }

    queue.start().then((res) => {
      saveTokensJsonFile();
    })
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