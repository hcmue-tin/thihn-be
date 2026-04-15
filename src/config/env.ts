import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUsername: process.env.DB_USERNAME || "root",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "thihn",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  autoResetContestOnBoot: process.env.AUTO_RESET_CONTEST_ON_BOOT
    ? process.env.AUTO_RESET_CONTEST_ON_BOOT === "true"
    : (process.env.NODE_ENV || "development") === "development",
  jwtSecret: process.env.JWT_SECRET || "change_this_secret",
  jwtAdminExpiresIn: process.env.JWT_ADMIN_EXPIRES_IN || "12h",
  jwtContestantExpiresIn: process.env.JWT_CONTESTANT_EXPIRES_IN || "8h",
  /** Default password for contestants created via Excel import (plain text; hashed on save). */
  defaultContestantPassword: process.env.DEFAULT_CONTESTANT_PASSWORD || "thisinh123"
};
