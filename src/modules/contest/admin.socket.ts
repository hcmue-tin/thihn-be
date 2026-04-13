import { Server, Socket } from "socket.io";
import { z } from "zod";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { ContestService } from "./contest.service";
import { ContestScreen } from "./contest.stateMachine";

type AckResponse = { success: boolean; message?: string };
type AckFn = (response: AckResponse) => void;

const setScreenSchema = z.object({ screen: z.enum(["waiting", "rules", "team_list"]) });
const examSetSchema = z.object({ examSetId: z.number().int().positive() });
const questionSchema = z.object({ questionId: z.number().int().positive() });

export const registerAdminSocketHandlers = (
  io: Server,
  socket: Socket,
  contestService: ContestService,
  scheduleCountdownEnd: (endsAt: number) => void,
  clearCountdownEnd: () => void
): void => {
  const actor = (socket.data.user?.actor as string) || "system_admin";

  const safeHandle = async (
    ack: AckFn | undefined,
    action: string,
    payload: Record<string, unknown>,
    handler: () => Promise<void>
  ): Promise<void> => {
    try {
      await handler();
      await contestService.writeAudit(actor, action, payload);
      ack?.({ success: true });
    } catch (error) {
      logger.warn({ error, action }, "Admin socket action failed");
      const message =
        error instanceof z.ZodError
          ? error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; ")
          : error instanceof AppError
            ? error.message
            : "Internal error";
      ack?.({ success: false, message });
    }
  };

  socket.on("admin:set-screen", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:set-screen", rawPayload ?? {}, async () => {
      const payload = setScreenSchema.parse(rawPayload);
      const state = await contestService.setScreen(payload.screen as ContestScreen);
      if (payload.screen === "rules") {
        io.emit("screen:change", {
          screen: state.screen,
          data: { rulesContent: await contestService.getRulesContent() }
        });
        return;
      }

      io.emit("screen:change", { screen: state.screen });

      if (payload.screen === "team_list") {
        io.emit("team-list:show", { teams: await contestService.getTeamList() });
      }
    });
  });

  socket.on("admin:select-exam-set", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:select-exam-set", rawPayload ?? {}, async () => {
      const payload = examSetSchema.parse(rawPayload);
      const state = await contestService.selectExamSet(payload.examSetId);
      io.emit("contest:sync-state", { fullState: state });
    });
  });

  socket.on("admin:show-question", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-question", rawPayload ?? {}, async () => {
      const payload = questionSchema.parse(rawPayload);
      const result = await contestService.showQuestion(payload.questionId);
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("question:show", {
        question: result.question,
        options: result.options,
        countdownSeconds: result.question.countdownSeconds
      });
    });
  });

  socket.on("admin:start-countdown", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:start-countdown", rawPayload ?? {}, async () => {
      const payload = questionSchema.parse(rawPayload);
      const result = await contestService.startCountdown(payload.questionId);
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("countdown:start", { seconds: result.seconds, endsAt: result.endsAt });
      scheduleCountdownEnd(result.endsAt);
    });
  });

  socket.on("admin:stop-countdown", async (_rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:stop-countdown", {}, async () => {
      clearCountdownEnd();
      const state = await contestService.getCurrentState();
      if (!state.currentQuestionId) {
        throw new AppError("No active question to reveal", 400);
      }
      const result = await contestService.showAnswer(state.currentQuestionId);
      io.emit("countdown:end", {});
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("answer:reveal", {
        questionId: result.questionId,
        correctOptionIds: result.correctOptionIds,
        fillBlankAnswers: result.fillBlankAnswers,
        stats: result.stats
      });
      io.to("led-screen").emit("answer-results:show", {
        questionId: result.questionId,
        results: await contestService.getAnswerResultsForQuestion(result.questionId)
      });
      result.contestantResults.forEach((item) => {
        io.to(`contestant:${item.contestantId}`).emit("contestant:answer-result", {
          questionId: item.questionId,
          isCorrect: item.isCorrect,
          scoreEarned: item.scoreEarned,
          totalScore: item.totalScore
        });
      });
    });
  });

  socket.on("admin:show-answer", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-answer", rawPayload ?? {}, async () => {
      clearCountdownEnd();
      const payload = questionSchema.parse(rawPayload);
      const result = await contestService.showAnswer(payload.questionId);
      io.emit("countdown:end", {});
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("answer:reveal", {
        questionId: result.questionId,
        correctOptionIds: result.correctOptionIds,
        fillBlankAnswers: result.fillBlankAnswers,
        stats: result.stats
      });
      io.to("led-screen").emit("answer-results:show", {
        questionId: result.questionId,
        results: await contestService.getAnswerResultsForQuestion(result.questionId)
      });
      result.contestantResults.forEach((item) => {
        io.to(`contestant:${item.contestantId}`).emit("contestant:answer-result", {
          questionId: item.questionId,
          isCorrect: item.isCorrect,
          scoreEarned: item.scoreEarned,
          totalScore: item.totalScore
        });
      });
    });
  });

  socket.on("admin:show-team-score", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-team-score", rawPayload ?? {}, async () => {
      const payload = examSetSchema.parse(rawPayload);
      const result = await contestService.showTeamScore(payload.examSetId);
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("team-score:show", { examSetId: result.examSetId, teams: result.teams });
    });
  });

  socket.on("admin:show-leaderboard", async (_rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-leaderboard", {}, async () => {
      const result = await contestService.showLeaderboard();
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("leaderboard:show", { rankings: result.rankings });
    });
  });

  socket.on("admin:reset-session", async (_rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:reset-session", {}, async () => {
      clearCountdownEnd();
      const state = await contestService.resetSession();
      io.emit("countdown:end", {});
      io.emit("contest:sync-state", { fullState: state });
      io.emit("screen:change", { screen: state.screen });
    });
  });
};
