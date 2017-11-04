module.exports =  {
	ENDPOINT: {
		FEED_REQUEST: "feed/latest/:id"
	},

	METRICS: {
		'register': {
			'success': "register.success",
			'invalid_code': "register.invalid_code",
			'claimed': 'register.already_claimed_code'
		},
		'add_address': {
			'success': "add_address.success",
			'invalid_address': 'add_address.invalid_address',
		},
		'refresh_address': {
			'success': 'refresh_address.success',
			'failed': 'refresh_address.failed',
		},
		'delete_address': {
			'success': 'delete_address.success',
			'failed': 'delete_address.failed',
		},
		'get_portfolio': {
			'success': 'get_portfolio.success',
			'failed': 'get_portfolio.failed',
		},
		'add_notification': {
			'success': 'add_notification.success',
			'failed': 'add_notification.failed',
		}
	}
}