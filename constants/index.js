module.exports =  {
  ENDPOINT: {
    FEED_REQUEST: '/latest',
    FEED_ACTIVITY: '/:id/action',
    ICO_BADGE: '/badge-count',
  },

  METRICS: {
    'register': {
      'success': '.account.register.success',
      'invalid_code': '.account.register.invalid_code',
      'claimed': '.account.register.already_claimed_code',
      'failed': '.account.register.failed',
    },
    'add_address': {
      'success': '.account.add_address.success',
      'invalid_address': '.account.add_address.invalid_address',
    },
    'refresh_address': {
      'success': '.account.refresh_address.success',
      'failed': '.account.refresh_address.failed',
    },
    'delete_address': {
      'success': '.account.delete_address.success',
      'failed': '.account.delete_address.failed',
    },
    'get_portfolio': {
      'success': '.account.get_portfolio.success',
      'failed': '.account.get_portfolio.failed',
    },
    'add_notification': {
      'success': '.account.add_notification.success',
      'failed': '.account.add_notification.failed',
    },
    'login': {
      'failed': '.account.login.failed'
    }
  },
};
