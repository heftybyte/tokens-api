# tokens-api
Api for ERC-20 token http://erc-20.io

Use `npm` instead of `yarn` until the following web3/yarn bugs are resolved:
- https://github.com/ethereum/web3.js/issues/966
- https://github.com/yarnpkg/yarn/issues/711


## Dependencies

### ArangoDB

Installation

```
$ brew install arangodb
```


After installing, create the database `tokens-api`. Go to `server/datasources.json` and verify the setting for your database 

You'll need to enable auth on your arangodb instance 

Connect to the database

```
$ arangosh --server.endpoint tcp://127.0.0.1:8529 --server.database "_system"
```

Set password to enable auth

```
arangosh> require("org/arangodb/users").save("root", "arangodb");
```

next you need to migrate the database

```
$ npm run automigrate
```

or for a specific model


```
$ npm run automigrate ModelName
```
