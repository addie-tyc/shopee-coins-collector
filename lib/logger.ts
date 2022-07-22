import * as winston from 'winston'

export const logger = winston.createLogger({
  level: 'debug',
  exitOnError: true,
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      level: 'info',
      stderrLevels: ['debug', 'info', 'warn', 'error'],
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})
