// leaving this in incase we need to do something similar in the future
import fastCsv from 'fast-csv';
import tokensData from '../data/tokens.json';
import path from 'path';
import fs from 'fs';
import writeJson from 'write-json-file';

var stream = fs.createReadStream(path.join(__dirname, '../data/tokens.csv'));

fastCsv
    .fromStream(stream, {headers: true})
    .transform(
        data => validateUrl(data.videoUrl) ?
            data : {symbol: data.symbol, videoUrl: null})
    .on('data', data => {
        const symbol = data.symbol.toUpperCase();
        if (tokensData[symbol]) {
            tokensData[symbol]['videoUrl'] = data.videoUrl ? data.videoUrl : null;
        }
    })
    .on('end', () => {
        writeJson(path.join(__dirname, '../data/tokens.json'), tokensData).then(() => console.log('write done'));
    });

// not all the URI are actual playble videos so I'm filtering them out
const validateUrl = (videoUrl) => videoUrl
        .match(/https?:\/\/(www\.)?(vimeo|youtu)/) || videoUrl.match(/.mp4$/);
