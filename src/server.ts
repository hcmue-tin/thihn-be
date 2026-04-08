import { app } from "./app";
import { AppDataSource } from "./config/database";
import { env } from "./config/env";
import { logger } from "./shared/utils/logger";

const start = async (): Promise<void> => {
  await AppDataSource.initialize();
  app.listen(env.port, () => {
    logger.info(`Backend running on port ${env.port}`);
  });
};

start().catch((error) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});
