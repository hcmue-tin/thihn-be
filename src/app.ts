import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import { logger } from "./shared/utils/logger";
import { authRouter } from "./modules/auth/auth.routes";
import { teamRouter } from "./modules/team/team.routes";
import { contestantRouter } from "./modules/contestant/contestant.routes";
import { examRouter } from "./modules/exam/exam.routes";
import { uploadRouter } from "./modules/upload/upload.routes";
import { errorHandler } from "./shared/middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  }),
  authRouter
);

app.use("/api/teams", teamRouter);
app.use("/api/contestants", contestantRouter);
app.use("/api", examRouter);
app.use("/api", uploadRouter);
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use(errorHandler);
