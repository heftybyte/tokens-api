const speakeasy = require('speakeasy');

export const verifyTwoFactorToken = async function (token, secret) {
 const verified = speakeasy.totp.verify({ secret: secret,
                                       encoding: 'base32',
                                       token: token });
 return verified;
}

export const generateTwoFactorKey = async function (){
	const secret = speakeasy.generateSecret();
	return secret.base32;
}