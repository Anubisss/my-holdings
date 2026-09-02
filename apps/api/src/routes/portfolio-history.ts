import type { FastifyInstance } from 'fastify';

import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { exportCsv, importCsv, isImportError } from '../lib/portfolio-history.js';

export const registerPortfolioHistoryRoutes = (app: FastifyInstance): void => {
  app.get('/api/portfolio-history/export', async (_request, reply) => {
    const { csv, filename } = exportCsv();

    logger.info('Portfolio history exported');

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
  });

  app.post('/api/portfolio-history/import', async (request, reply) => {
    const file = await request.file();
    if (!file) throw badRequest('No file uploaded');

    const buf = await file.toBuffer();
    const result = importCsv(buf.toString('utf-8'));

    if (isImportError(result)) {
      return reply.code(400).send(result);
    }

    logger.info(`Portfolio history imported: ${result.imported} rows imported`);
    return reply.code(200).send(result);
  });
};
