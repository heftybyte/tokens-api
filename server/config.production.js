module.exports = {
  "restApiRoot": "/api",
  "swagger": {
    "protocol": "https"
  },
  "host": "0.0.0.0",
  "port": 8081,
  "remoting": {
    "context": false,
    "rest": {
      "handleErrors": false,
      "normalizeHttpPath": false,
      "xml": false
    },
    "json": {
      "strict": false,
      "limit": "100kb"
    },
    "urlencoded": {
      "extended": true,
      "limit": "100kb"
    },
    "cors": false
  }
}
