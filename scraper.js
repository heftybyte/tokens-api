const request = require('request');
const async = require('async');
const path = require('path');
const fs = require('fs');

const basePath = path.resolve(__dirname);

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

          const urls = Object.keys(JSON.parse(body));

          async.each(urls, (url) => {
            console.log(`Fetching image for ${url}`);

            request(imageUrl(url), {encoding: 'binary'}, (err, res, body) => {
              fs.writeFile(basePath + `/client/img/tokens/${url}.png`, body, 'binary', (err) => {
                if (err) throw err;

                console.log(`Image downloaded and saved to ${basePath}/client/img/tokens/${url}.png`);
              })
            })
          }, (err) => { throw err; })
        }).catch(ex => { throw ex; });

        console.log('All done')
      })
      .catch(err => {
        throw err;
      })
  }
});


