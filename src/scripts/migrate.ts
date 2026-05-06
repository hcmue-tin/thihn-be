import { AppDataSource } from "../config/database";
import { logger } from "../shared/utils/logger";

interface ColumnRow {
  COLUMN_NAME: string;
}

const migrations: Array<{ name: string; up: (db: typeof AppDataSource) => Promise<void> }> = [
  {
    name: "add_led_waiting_background_url_to_contest_state",
    async up(db) {
      const qr = db.createQueryRunner();
      await qr.connect();
      try {
        const dbName = db.options.database as string;
        const rows: ColumnRow[] = await qr.query(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'contest_state' AND COLUMN_NAME = 'led_waiting_background_url'`,
          [dbName]
        );
        if (rows.length > 0) {
          logger.info("  [skip] led_waiting_background_url already exists");
          return;
        }
        await qr.query(
          `ALTER TABLE contest_state
           ADD COLUMN led_waiting_background_url VARCHAR(500) NULL
           AFTER led_background_url`
        );
        logger.info("  [done] added led_waiting_background_url");
      } finally {
        await qr.release();
      }
    }
  }
];

async function main() {
  await AppDataSource.initialize();
  logger.info("Running migrations...");
  for (const migration of migrations) {
    logger.info(`-> ${migration.name}`);
    await migration.up(AppDataSource);
  }
  logger.info("All migrations complete.");
  await AppDataSource.destroy();
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
