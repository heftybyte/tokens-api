const winston = require('winston');

const {combine, timestamp, label, printf} = winston.format;

// eslint-disable-next-line no-unused-expressions
require('winston-papertrail').Papertrail;

const logFormat = printf(info => {
  return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});

const winstonPapertrail = new winston.transports.Papertrail({
  host: 'logs6.papertrailapp.com',
  port: 25318,
});

const consoleLogger = new winston.transports.Console({
  timestamp: function() {
    return new Date().toString();
  },
});

const initLogger = (fieldType) => winston.createLogger({
  format: combine(
		label({label: fieldType}),
		timestamp(),
	  logFormat
	),
  transports: [
  	winstonPapertrail,
	  consoleLogger,
  ],
});

export const serverLogger = initLogger('server');
export const clientLogger = initLogger('client');

