const speakeasy = require('speakeasy');

export const verifyTwoFactorToken = async function (token, secret, time) {
	var token = await speakeasy.totp({
  secret: secret,
  encoding: 'base32',
  time: time // specified in seconds
});
	console.log(token)
	
 const verified = await speakeasy.totp.verify({ secret: secret,
                                       encoding: 'base32',
                                       token: token,
                                       time: time });
 return verified;
}

export const generateTwoFactorKey = async function (){
	const secret = await speakeasy.generateSecret();
	console.log(secret.otpauth_url)
	return secret.base32;
}