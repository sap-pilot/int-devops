const winston = require("winston");
const environment = process.env.NODE_ENV;

let alignColorsAndTime = winston.format.combine(
    winston.format.colorize({
        all: true
    }),
    winston.format.label({
        label: '[LOGGER]'
    }),
    winston.format.timestamp({
        format: "YYMMDD HH:mm:ss"
    }),
    winston.format.printf(
        info => (environment === 'production') ? `[${info.level}] ${info.message}` : `${info.timestamp} [${info.level}] ${info.message}`
    )
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL? process.env.LOG_LEVEL : 'debug',
    transports: [
        new (winston.transports.Console)({
            format: winston.format.combine(winston.format.colorize(), alignColorsAndTime)
        })
    ],
});

module.exports = { logger };