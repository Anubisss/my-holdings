import type { FastifyBaseLogger } from 'fastify';
import { pino } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Shared application logger. The same instance backs Fastify (passed via
 * `loggerInstance`) and any non-request code paths (e.g. quote fetching,
 * startup, migrations) so every line goes through one pino pipeline.
 * In non-production environments logs are pretty-printed for readability.
 *
 * Typed as `FastifyBaseLogger` (which pino's `Logger` satisfies) so Fastify
 * keeps its default logger type when this instance is passed in.
 */
export const logger: FastifyBaseLogger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
        },
      }),
});
