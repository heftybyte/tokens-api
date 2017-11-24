const Logger = require('le_node');

export const logger = new Logger({
  token: process.env.LOGENTRIES_LOG || 'cf346e5f-239f-4073-8b73-7041e348c74f',
});

const initLogger = (type, message, level) => logger.log({type, message, level});

export const clientLogger = (message, level) => initLogger('client', message, level);

export const serverLogger = (message, level) => initLogger('server', message, level);
