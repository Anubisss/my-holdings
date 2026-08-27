import { buildApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { logger } from './lib/logger.js';
import { startScheduler } from './lib/scheduler.js';

const start = async (): Promise<void> => {
  runMigrations();

  const app = buildApp();
  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(`Node version: ${process.version}`);
    logger.info(`API listening on http://${config.host}:${config.port}`);
  } catch (error) {
    logger.error(error, 'Failed to start API server');
    process.exit(1);
  }

  if (config.portfolioValueHistoryEnabled) {
    void startScheduler();
  } else {
    logger.info('Portfolio value history is disabled');
  }

  if (config.telegram) {
    logger.info('Telegram notifications enabled');
  } else {
    logger.info('Telegram notifications disabled (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set)');
  }
};

void start();
