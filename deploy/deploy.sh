echo ">> Running npm install"
npm install
echo "----- npm install done ---"
echo ">> Running npm bild"
npm run build
echo "---- npm build done ----"
cd dist/
pm2 startOrRestart deploy/ecosystem.config.js -i 4 --update-env

