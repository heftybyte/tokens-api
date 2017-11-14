import server from '../server/server';
import dotenv from 'dotenv';
import redisClient from '../server/boot/redisConnector';

dotenv.config();

const Account = server.models.Account;

let err = null;

const email = process.env.DEV_LOGIN_USER_NAME || 'tom@petty.com';
const password = process.env.DEV_LOGIN_PASSWORD || 'petty';

Account.create({
  email,
  password,
}).catch(e=> err = e);

if (err) {
  console.log('Failed creating test dev account');
} else {
  console.log(`Created test dev account.
     email: ${email}, password: ${password}`);
};

redisClient.quit();
