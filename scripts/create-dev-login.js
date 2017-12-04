import server from '../server/server';
import dotenv from 'dotenv';
import redisClient from '../server/boot/redisConnector';

dotenv.config();

const Account = server.models.Account;

let err = null;

const username = process.env.DEV_LOGIN_USER_NAME || 'tompetty';
const password = process.env.DEV_LOGIN_PASSWORD || 'petty';

Account.create({
  username,
  password,
}).catch(e=> err = e);

if (err) {
  console.log('Failed creating test dev account');
} else {
  console.log(`Created test dev account.
  username: ${username}, password: ${password}`);
};

redisClient.quit();
