const { createLogger, format, transports }= require("winston");

const logRedact = process.env.LOG_REDACT != "false";
const environment = process.env.NODE_ENV;

const errorStackFormat = format(info => {
    if (info instanceof Error) {
      return Object.assign({}, info, {
        stack: info.stack,
        message: info.message
      })
    }
    return info
  })

  
let alignColorsAndTime = format.combine(
    format.errors({ stack: true }), // <-- use errors format,
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
            // if (environment === 'production') {
            //     return `[${info.level}] ${str}`;
            // }  else {
            //     return `${info.timestamp} [${info.level}] ${str}`
            // } 
            return info.stack
                ? `${str}\n${info.stack}`
                : str;
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