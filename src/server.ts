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
import { ContestSession } from "./modules/contest/contestSession.entity";

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

  // --- MIGRATION SCRIPT ---
  // Ensure historical sessions from `answers` table are migrated into `contest_sessions`
  const historicalSessions = await AppDataSource.query(`
    SELECT a.session_id as sessionId, c.team_id as teamId
    FROM answers a
    INNER JOIN contestants c ON c.id = a.contestant_id
    GROUP BY a.session_id, c.team_id
  `);
  
  const contestSessionRepo = AppDataSource.getRepository(ContestSession);
  for (const hs of historicalSessions) {
    const exists = await contestSessionRepo.findOne({ where: { id: hs.sessionId } });
    if (!exists) {
      await contestSessionRepo.save(
        contestSessionRepo.create({
          id: hs.sessionId,
          teamId: hs.teamId
        })
      );
      logger.info(`Migrated historical session ${hs.sessionId} to contest_sessions table.`);
    }
  }
  // ------------------------

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
    socket.emit("contest:sync-state", { fullState: state, serverNow: Date.now() });
    if (state.screen === "rules") {
      socket.emit("screen:change", {
        screen: state.screen,
        data: {
          rulesContent: state.rulesContent ?? null,
          backgroundUrl: state.backgroundUrl ?? null,
          ledBackgroundUrl: state.ledBackgroundUrl ?? state.backgroundUrl ?? null,
          ledWaitingBackgroundUrl: state.ledWaitingBackgroundUrl ?? null,
          contestantBackgroundUrl: state.contestantBackgroundUrl ?? state.backgroundUrl ?? null
        }
      });
    }
    if (state.screen === "team_list") {
      const ids = state.activeTeamId != null ? [state.activeTeamId] : [];
      socket.emit("team-list:show", { teams: await contestService.getTeamList(ids) });
    }
    if (state.currentQuestionId) {
      const { question, options } = await contestService.getQuestionDisplayData(state.currentQuestionId);
      socket.emit("question:show", {
        question,
        options,
        countdownSeconds: question.countdownSeconds,
        shownAt: Date.now()
      });
      if (role === "contestant") {
        const contestantId = socket.data.user?.contestantId as number | undefined;
        if (contestantId) {
          const existingSubmission = await submissionService.getExistingSubmission(
            contestantId,
            state.currentQuestionId,
            state.currentSessionId
          );
          if (existingSubmission) {
            socket.emit("contestant:answer-received", existingSubmission);
          }
        }
      }
      if (state.screen === "reveal" && clientType === "led") {
        const teamFilter = state.activeTeamId != null ? [state.activeTeamId] : null;
        const reveal = await contestService.getRevealPayload(state.currentQuestionId, state.currentSessionId);
        socket.emit("answer:reveal", {
          questionId: reveal.questionId,
          correctOptionIds: reveal.correctOptionIds,
          fillBlankAnswers: reveal.fillBlankAnswers,
          stats: reveal.stats
        });
        socket.emit("answer-results:show", {
          questionId: state.currentQuestionId,
          results: await contestService.getAnswerResultsForQuestion(state.currentQuestionId, teamFilter, state.currentSessionId)
        });
      }
      if (state.screen === "reveal" && clientType !== "led") {
        const reveal = await contestService.getRevealPayload(state.currentQuestionId, state.currentSessionId);
        socket.emit("answer:reveal", {
          questionId: reveal.questionId,
          correctOptionIds: reveal.correctOptionIds,
          fillBlankAnswers: reveal.fillBlankAnswers,
          stats: reveal.stats
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
