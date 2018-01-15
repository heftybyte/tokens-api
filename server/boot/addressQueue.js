const Queue = require('bull')

module.exports = app => {

	const scanQueue = new Queue('address_scanner', {
		redis: { 
			port: process.env.REDIS_PORT || 6379,
			host: process.env.REDIS_HOST || '127.0.0.1',
		}
	})

	const newAddressQueue = new Queue('new_address', {
		redis: { 
			port: process.env.REDIS_PORT || 6379,
			host: process.env.REDIS_HOST || '127.0.0.1',
		}
	})

	const backfillBalanceQueue = new Queue('backfill_balances', {
		limiter: {
			max: 2,
			duration: 1000 * 3600
		},
		redis: { 
			port: process.env.REDIS_PORT || 6379,
			host: process.env.REDIS_HOST || '127.0.0.1',
		}
	})

	scanQueue.on('completed', (job, balances)=>{
		const { address, userId } = job
		console.log('scan complete', job, balances, app.models.Account)
	})

	app.queues = {}
	app.queues.address = {
		scanQueue,
		newAddressQueue,
		backfillBalanceQueue
	}
	console.log('listening for scan queue jobs', !!scanQueue)
}