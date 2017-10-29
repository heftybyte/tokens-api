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


After installing, create the database `tokens-api`. 
Create an `.env` file mirroring `.env.example` and set the database connection values in it. 

You'll need to enable auth on your arangodb instance 

Connect to the database

```
$ arangosh --server.endpoint tcp://127.0.0.1:8529 --server.database "_system"
```

Set password to enable auth

```
arangosh> require("org/arangodb/users").save("root", DB_PASSWORD);
```

next you need to migrate the database

```
$ npm run automigrate
```

or for a specific model


```
$ npm run automigrate ModelName
```

### Redis
If you don't have Redis installed, install it.

#### Windows
 [Install Redis on Windows](https://redislabs.com/ebook/appendix-a/a-3-installing-on-windows/a-3-2-installing-redis-on-window/)

#### Mac
[Install Redis on Mac](https://gist.github.com/nrollr/eb24336b8fb8e7ba5630) - You need [Homebrew](https://brew.sh/) for this.