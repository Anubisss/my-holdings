import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { HttpError } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { registerAccountRoutes } from './routes/accounts.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerHoldingRoutes } from './routes/holdings.js';
import { registerSummaryRoutes } from './routes/summary.js';
import { registerWatchlistRoutes } from './routes/watchlist.js';

export const buildApp = (): FastifyInstance => {
  const app = Fastify({
    loggerInstance: logger,
    // Suppress Fastify's automatic per-request "incoming request" /
    // "request completed" logs; we only want our explicit log lines.
    disableRequestLogging: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.validation,
      });
    }

    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.name, message: error.message });
    }

    app.log.error(error);

    return reply.code(error.statusCode ?? 500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  });

  registerConfigRoutes(app);
  registerAccountRoutes(app);
  registerHoldingRoutes(app);
  registerWatchlistRoutes(app);
  registerSummaryRoutes(app);

  return app;
};
