module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [
    // First application
    {
      name      : 'Tokens Express',
      script    : 'server/server.js',
      env: {
        COMMON_VARIABLE: 'true'
      },
      env_production : {
        NODE_ENV: 'production'
      }
    },

  ],

  /**
   * Deployment section
   * http://pm2.keymetrics.io/docs/usage/deployment/
   */
  deploy : {
    production : {
      key : '/Users/Samparsky/Sites/nodejs/tokens-api/deploy/parity-server.pem',
      user : 'ubuntu',
      host : '54.186.146.236',
      ref  : 'origin/master',
      repo : 'git@github.com:heftybyte/tokens-api.git',
      path : '/var/www/tokens-express/',
      'post-deploy' : 'npm install && npm run build'
    },
    dev : {
      user : 'node',
      host : '212.83.163.1',
      ref  : 'origin/master',
      repo : 'git@github.com:tokens-api.git',
      path : '/var/www/development',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env dev',
      env  : {
        NODE_ENV: 'dev'
      }
    }
  }
};
