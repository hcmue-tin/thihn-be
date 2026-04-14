import { app } from "./app";
import { AppDataSource } from "./config/database";
import { env } from "./config/env";
import { logger } from "./shared/utils/logger";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt, { Secret } from "jsonwebtoken";
import { JwtUser } from "./shared/middleware/auth";
import { ContestService } from "./modules/contest/contest.service";
import { registerAdminSocketHandlers } from "./modules/contest/admin.socket";
import { registerContestantSocketHandlers } from "./modules/contest/contestant.socket";
import { SubmissionService } from "./modules/submission/submission.service";

const start = async (): Promise<void> => {
  await AppDataSource.initialize();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });
  const contestService = new ContestService();
  const submissionService = new SubmissionService();
  let countdownTimer: NodeJS.Timeout | null = null;

  const clearCountdownEnd = (): void => {
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
  };

  const scheduleCountdownEnd = (endsAt: number): void => {
    clearCountdownEnd();
    const delay = Math.max(0, endsAt - Date.now());
    countdownTimer = setTimeout(async () => {
      try {
        await contestService.markCountdownEnded();
        io.emit("countdown:end", {});
      } finally {
        countdownTimer = null;
      }
    }, delay);
  };

  if (env.autoResetContestOnBoot) {
    await contestService.resetSession();
    logger.info("Contest session reset on server boot");
  }

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error("Missing auth token"));
      }
      const payload = jwt.verify(token, env.jwtSecret as Secret) as JwtUser;
      socket.data.user = payload;
      return next();
    } catch {
      return next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", async (socket) => {
    const role = socket.data.user?.role as string | undefined;
    const clientType = socket.handshake.auth?.clientType as string | undefined;

    if (role === "admin") {
      socket.join("admin");
      if (clientType === "led") {
        socket.join("led-screen");
      }
      registerAdminSocketHandlers(io, socket, contestService, scheduleCountdownEnd, clearCountdownEnd);
    }

    if (role === "contestant") {
      socket.join("contest");
      registerContestantSocketHandlers(io, socket, submissionService);
    }

    const state = await contestService.getCurrentState();
    socket.emit("contest:sync-state", { fullState: state });
    if (state.screen === "rules") {
      socket.emit("screen:change", {
        screen: state.screen,
        data: { rulesContent: state.rulesContent ?? null, backgroundUrl: state.backgroundUrl ?? null }
      });
    }
    if (state.screen === "team_list") {
      socket.emit("team-list:show", { teams: await contestService.getTeamList() });
    }
    if (state.currentQuestionId) {
      const { question, options } = await contestService.getQuestionDisplayData(state.currentQuestionId);
      socket.emit("question:show", {
        question,
        options,
        countdownSeconds: question.countdownSeconds
      });
      if (state.screen === "reveal" && clientType === "led") {
        socket.emit("answer-results:show", {
          questionId: state.currentQuestionId,
          results: await contestService.getAnswerResultsForQuestion(state.currentQuestionId)
        });
      }
    }
  });

  httpServer.listen(env.port, () => {
    logger.info(`Backend running on port ${env.port}`);
  });
};

start().catch((error) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});
