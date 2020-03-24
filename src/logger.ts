import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format:
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.simple(),
        ),
  defaultMeta: { service: 'lighthouse-audit-service' },
  transports: [new winston.transports.Console()],
});

if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  );
  logger.add(new winston.transports.File({ filename: 'combined.log' }));
}

export default logger;
