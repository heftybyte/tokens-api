const speakeasy = require('speakeasy');

export const verifyTwoFactorToken = async function (token, secret) {
	const verified = await speakeasy.totp.verify({ secret: secret,
	                                   encoding: 'base32',
	                                   token: token });
	return verified;
}

export const generateTwoFactorKey = async function (){
	const secret = await speakeasy.generateSecret();
	console.log(secret.otpauth_url)
	return secret.base32;
}