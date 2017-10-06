# tokens-api
Api for ERC-20 token http://erc-20.io

You need to install arangoDB

running `brew install arangodb` on a mac should do.

after installing, create the database `tokens-api`

go to `server/datasources.json` and verify the setting for your database 

next you need to migrate the database

run `npm run initial-migration`
