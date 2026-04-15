import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DB_HOST: z.string().min(1).default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USERNAME: z.string().min(1).default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1).default("thihn"),
  ADMIN_PASSWORD: z.string().min(1).default("admin123"),
  AUTO_RESET_CONTEST_ON_BOOT: z.enum(["true", "false"]).optional(),
  JWT_SECRET: z.string().min(1).default("dev"),
  JWT_ADMIN_EXPIRES_IN: z.string().min(1).default("12h"),
  JWT_CONTESTANT_EXPIRES_IN: z.string().min(1).default("8h"),
  DEFAULT_CONTESTANT_PASSWORD: z.string().min(1).default("thisinh123"),
  DB_SYNCHRONIZE: z.enum(["true", "false"]).optional()
});

const parsed = envSchema.parse(process.env);
const isProd = parsed.NODE_ENV === "production";
if (isProd && (parsed.JWT_SECRET === "change_this_secret" || parsed.ADMIN_PASSWORD === "admin123")) {
  throw new Error("In production, ADMIN_PASSWORD and JWT_SECRET must be customized.");
}

export const env = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  dbHost: parsed.DB_HOST,
  dbPort: parsed.DB_PORT,
  dbUsername: parsed.DB_USERNAME,
  dbPassword: parsed.DB_PASSWORD,
  dbName: parsed.DB_NAME,
  adminPassword: parsed.ADMIN_PASSWORD,
  autoResetContestOnBoot:
    parsed.AUTO_RESET_CONTEST_ON_BOOT !== undefined
      ? parsed.AUTO_RESET_CONTEST_ON_BOOT === "true"
      : parsed.NODE_ENV === "development",
  jwtSecret: parsed.JWT_SECRET,
  jwtAdminExpiresIn: parsed.JWT_ADMIN_EXPIRES_IN,
  jwtContestantExpiresIn: parsed.JWT_CONTESTANT_EXPIRES_IN,
  defaultContestantPassword: parsed.DEFAULT_CONTESTANT_PASSWORD,
  dbSynchronize: parsed.DB_SYNCHRONIZE ? parsed.DB_SYNCHRONIZE === "true" : parsed.NODE_ENV !== "production"
};
