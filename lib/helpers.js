const BigNumber = require('bignumber.js');

export const toDecimal = (num, decimals) => (
    (new BigNumber(num)).dividedBy(Math.pow(10, decimals)));
