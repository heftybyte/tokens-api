const Queue = require('bull')
import Expo from 'expo-server-sdk';
console.log({Expo}, Expo.isExpoPushToken)
module.exports = app => {
	const expo = new Expo()

	const redis = { 
		port: process.env.REDIS_PORT || 6379,
		host: process.env.REDIS_HOST || '127.0.0.1',
		password: process.env.REDIS_PASSWORD
	}

	const scanQueue = new Queue('address_scanner', { redis })

	const scanCompleteQueue = new Queue('address_scan_complete', { redis })

	const newAddressQueue = new Queue('new_address', { redis })

	const backfillBalanceQueue = new Queue('backfill_balances', {
		limiter: {
			max: 2,
			duration: 1000 * 3600
		},
		redis
	})

	scanCompleteQueue.process(async (job)=>{
		console.log('scan complete', job.data)

		const { address, numTokens, userId } = job.data
		const account = await app.loopback.getModel('account').findById(userId)
		const messages = account.notification_tokens.toJSON()
			.filter(pushToken=>Expo.isExpoPushToken(pushToken))
			.map(pushToken=>({
				to: pushToken,
				sound: 'default',
				body: numTokens ? 
					`We found ${numTokens} tokens in ${address}` :
					`No tokens were found in ${address}`,
				data: {
					address,
					numTokens,
					type: 'ADDRESS_SCANNED'
				}
			}))

		console.log({messages})
		const chunks = expo.chunkPushNotifications(messages)
		for (const chunk of chunks) {
			try {
				const receipt = await expo.sendPushNotificationsAsync(chunk)
				console.log({receipt})
			} catch (e) {
				console.error('error', e)
			}
		}
	})

	app.queues = {}
	app.queues.address = {
		scanQueue,
		newAddressQueue,
		backfillBalanceQueue
	}
	console.log('listening for scan queue jobs', !!scanQueue)
}