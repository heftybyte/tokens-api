const Logger = require('le_node');

export const logger = new Logger({
  token: process.env.LOGENTRIES_LOG || '',
});

const initLogger = (type, message, level) => logger.log({type, message, level});

export const clientLogger = (message, level) => initLogger('client', message, level);

export const serverLogger = (message, level) => initLogger('server', message, level);
