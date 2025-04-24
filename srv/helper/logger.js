const { createLogger, format, transports }= require("winston");
const redact = require('redact-secrets')('[REDACTED]');

const logRedact = process.env.LOG_REDACT != "false";
const environment = process.env.NODE_ENV;

let alignColorsAndTime = format.combine(
    format.colorize({
        all: true
    }),
    format.label({
        label: '[LOGGER]'
    }),
    format.timestamp({
        format: "YYMMDD HH:mm:ss"
    }),
    format.printf(
        info => {
            let str = info.message;
            if(logRedact && str) {
                str = str.replace(/\/\/(.*?)\@/, "//[redacted]@");
                str = str.replace(/(Authorization\"\:) \"[^\"]+/i, "$1 \"[redacted]");
            }
            if (environment === 'production') {
                return `[${info.level}] ${str}`;
            }  else {
                return `${info.timestamp} [${info.level}] ${str}`
            } 
        }
    )
);

const logger = createLogger({
    level: process.env.LOG_LEVEL? process.env.LOG_LEVEL : 'debug',
    transports: [
        new (transports.Console)({
            format: format.combine(format.colorize(), alignColorsAndTime)
        })
    ],
});

module.exports = { logger };