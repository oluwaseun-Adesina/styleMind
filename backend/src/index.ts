import './config/env.js';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { initTelemetry } from './utils/telemetry.js';

const startServer = async () => {
  try {
    // No-op unless NEW_RELIC_LICENSE_KEY is set.
    await initTelemetry();
    await connectDB();
    logger.info('✅ Database connected');

    app.listen(env.PORT, () => {
      logger.info(`🚀 FitPick API running on http://localhost:${env.PORT}`);
      logger.info(`📊 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    // logger.error always writes to stderr — a fatal boot failure must be
    // visible even though the DB sink is unavailable here.
    logger.error('❌ Failed to start server', error as Error);
    process.exit(1);
  }
};

startServer();
