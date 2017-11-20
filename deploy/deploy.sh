echo "---- Running npm install ----"
npm install
echo "--- Running npm bild ----"
npm run build
echo "---- cd dist ----"
cd dist/
echo "--- npm auotupdate ---"
node ./server/migrations/autoupdate.js
echo "--- pm2 restart -----"
pm2 startOrRestart deploy/ecosystem.config.js -i 4 --update-env

