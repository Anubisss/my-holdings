import type { FastifyInstance } from 'fastify';

import { config } from '../config.js';

export const registerConfigRoutes = (app: FastifyInstance): void => {
  app.get('/api/config', async () => ({
    primaryCurrency: config.primaryCurrency,
    secondaryCurrency: config.secondaryCurrency,
  }));
};
