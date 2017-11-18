const path = require('path');
const fs = require("fs");

if (process.env.NODE_ENV === 'production' && process.env.PLATFORM == "digitalocean") {
	exports.privateKey = fs.readFileSync(path.join(__dirname, './private/privkey.pem')).toString();
	exports.certificate = fs.readFileSync(path.join(__dirname, './private/fullchain.pem')).toString();
}