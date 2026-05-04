import { Server, Socket } from "socket.io";
import { z } from "zod";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { ContestService } from "./contest.service";
import { ContestScreen } from "./contest.stateMachine";
import { AckFn, examSetSchema, leaderboardSchema, questionSchema, setActiveTeamSchema, setScreenSchema, teamScoreSchema } from "./contest.contracts";

export const registerAdminSocketHandlers = (
  io: Server,
  socket: Socket,
  contestService: ContestService,
  scheduleCountdownEnd: (endsAt: number) => void,
  clearCountdownEnd: () => void
): void => {
  const REVEAL_REFRESH_DELAY_MS = 3200;
  const actor = (socket.data.user?.actor as string) || "system_admin";
  let pendingContestantResults: Array<{
    contestantId: number;
    questionId: number;
    isCorrect: boolean;
    scoreEarned: number;
    totalScore: number;
  }> | null = null;
  let revealRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  const clearRevealRefreshTimer = () => {
    if (revealRefreshTimer) {
      clearTimeout(revealRefreshTimer);
      revealRefreshTimer = null;
    }
  };
  const emitRevealState = async (questionId: number, filterByActiveTeam: boolean): Promise<void> => {
    clearRevealRefreshTimer();
    const result = await contestService.showAnswer(questionId);
    io.emit("countdown:end", {});
    io.emit("screen:change", { screen: result.state.screen });
    io.emit("answer:reveal", {
      questionId: result.questionId,
      correctOptionIds: result.correctOptionIds,
      fillBlankAnswers: result.fillBlankAnswers,
      stats: result.stats
    });
    const teamFilter = filterByActiveTeam ? await contestService.getActiveTeamFilter() : null;
    const currentState = await contestService.getCurrentState();
    io.to("led-screen").emit("answer-results:show", {
      questionId: result.questionId,
      results: await contestService.getAnswerResultsForQuestion(result.questionId, teamFilter, currentState.currentSessionId)
    });
    io.emit("led:hide-solution", {});
    pendingContestantResults = result.contestantResults;
    revealRefreshTimer = setTimeout(() => {
      void (async () => {
        try {
          const refreshTeamFilter = filterByActiveTeam ? await contestService.getActiveTeamFilter() : null;
          const refreshState = await contestService.getCurrentState();
          const refreshed = await contestService.recomputeRevealResults(
            result.questionId,
            refreshTeamFilter,
            refreshState.currentSessionId
          );
          pendingContestantResults = refreshed.contestantResults;
          io.to("led-screen").emit("answer-results:show", {
            questionId: result.questionId,
            results: refreshed.answerRows
          });
        } catch (error) {
          logger.warn({ error, questionId: result.questionId }, "Failed to refresh reveal results after grace window");
        }
      })();
    }, REVEAL_REFRESH_DELAY_MS);
  };

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
      clearRevealRefreshTimer();
      const payload = setScreenSchema.parse(rawPayload);
      const activeTeamOpt =
        payload.teamIds && payload.teamIds.length > 0 ? { activeTeamId: payload.teamIds[0] ?? null } : undefined;
      const state = await contestService.setScreen(payload.screen as ContestScreen, activeTeamOpt);
      const bgPayload = {
        backgroundUrl: state.backgroundUrl ?? null,
        ledBackgroundUrl: state.ledBackgroundUrl ?? state.backgroundUrl ?? null,
        contestantBackgroundUrl: state.contestantBackgroundUrl ?? state.backgroundUrl ?? null
      };
      if (payload.screen === "rules") {
        io.emit("screen:change", {
          screen: state.screen,
          data: { rulesContent: state.rulesContent ?? null, ...bgPayload }
        });
        return;
      }

      io.emit("screen:change", { screen: state.screen, data: bgPayload });

      if (payload.screen === "team_list") {
        const listIds = state.activeTeamId != null ? [state.activeTeamId] : [];
        io.emit("team-list:show", { teams: await contestService.getTeamList(listIds) });
      }
    });
  });

  socket.on("admin:set-active-team", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:set-active-team", rawPayload ?? {}, async () => {
      const payload = setActiveTeamSchema.parse(rawPayload);
      const state = await contestService.setActiveTeam(payload.activeTeamId ?? null);
      io.emit("contest:sync-state", { fullState: state, serverNow: Date.now() });
    });
  });

  socket.on("admin:select-exam-set", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:select-exam-set", rawPayload ?? {}, async () => {
      const payload = examSetSchema.parse(rawPayload);
      const state = await contestService.selectExamSet(payload.examSetId);
      io.emit("contest:sync-state", { fullState: state, serverNow: Date.now() });
    });
  });

  socket.on("admin:show-question", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-question", rawPayload ?? {}, async () => {
      clearRevealRefreshTimer();
      pendingContestantResults = null;
      const payload = questionSchema.parse(rawPayload);
      const result = await contestService.showQuestion(payload.questionId, { activeTeamId: payload.activeTeamId ?? null });
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("question:show", {
        question: result.question,
        options: result.options,
        countdownSeconds: result.question.countdownSeconds,
        shownAt: Date.now()
      });
    });
  });

  socket.on("admin:start-countdown", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:start-countdown", rawPayload ?? {}, async () => {
      clearRevealRefreshTimer();
      pendingContestantResults = null;
      const payload = questionSchema.parse(rawPayload);
      const result = await contestService.startCountdown(payload.questionId, { activeTeamId: payload.activeTeamId ?? null });
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("countdown:start", { seconds: result.seconds, endsAt: result.endsAt, serverNow: Date.now() });
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
      await emitRevealState(state.currentQuestionId, true);
    });
  });

  socket.on("admin:show-answer", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-answer", rawPayload ?? {}, async () => {
      clearCountdownEnd();
      const payload = questionSchema.parse(rawPayload);
      await emitRevealState(payload.questionId, false);
    });
  });

  socket.on("admin:show-team-score", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-team-score", rawPayload ?? {}, async () => {
      const payload = teamScoreSchema.parse(rawPayload);
      const result = await contestService.showTeamScore(payload.examSetId, payload.teamIds, {
        activeTeamId: payload.activeTeamId ?? null
      });
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("team-score:show", { examSetId: result.examSetId, teams: result.teams });
    });
  });

  socket.on("admin:show-leaderboard", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:show-leaderboard", rawPayload ?? {}, async () => {
      const payload = leaderboardSchema.parse(rawPayload ?? {});
      const result = await contestService.showLeaderboard(payload.teamIds, { activeTeamId: payload.activeTeamId ?? null });
      io.emit("screen:change", { screen: result.state.screen });
      io.emit("leaderboard:show", { rankings: result.rankings, showAll: payload.showAll === true });
    });
  });

  socket.on("admin:leaderboard-page", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:leaderboard-page", rawPayload ?? {}, async () => {
      const payload = z.object({ direction: z.enum(["prev", "next"]) }).parse(rawPayload ?? {});
      io.to("led-screen").emit("leaderboard:page", { direction: payload.direction });
    });
  });

  socket.on("admin:retake-question", async (rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:retake-question", rawPayload ?? {}, async () => {
      clearRevealRefreshTimer();
      pendingContestantResults = null;
      const payload = questionSchema.parse(rawPayload);
      clearCountdownEnd();
      const state = await contestService.getCurrentState();
      await contestService.retakeQuestion(payload.questionId, state.currentSessionId);
      const result = await contestService.showQuestion(payload.questionId, { activeTeamId: payload.activeTeamId ?? null });
      io.emit("screen:change", { screen: result.state.screen, data: { backgroundUrl: result.state.backgroundUrl ?? null } });
      io.emit("question:show", {
        question: result.question,
        options: result.options,
        countdownSeconds: result.question.countdownSeconds,
        shownAt: Date.now()
      });
    });
  });

  socket.on("admin:play-led-audio", async (_rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:play-led-audio", {}, async () => {
      const state = await contestService.getCurrentState();
      if (!state.currentQuestionId) {
        throw new AppError("No active question", 400);
      }
      const { question } = await contestService.getQuestionDisplayData(state.currentQuestionId);
      if (!question.audioUrl) {
        throw new AppError("Current question has no audio", 400);
      }
      io.to("led-screen").emit("led:play-audio", { questionId: question.id, audioUrl: question.audioUrl });
    });
  });

  socket.on("admin:reveal-solution-on-led", async (_rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:reveal-solution-on-led", {}, async () => {
      const state = await contestService.getCurrentState();
      if (state.screen !== "reveal") {
        throw new AppError("Can only show LED solution in reveal screen", 400);
      }
      io.emit("led:show-solution", {});
      if (pendingContestantResults && pendingContestantResults.length > 0) {
        pendingContestantResults.forEach((item) => {
          io.to(`contestant:${item.contestantId}`).emit("contestant:answer-result", {
            questionId: item.questionId,
            isCorrect: item.isCorrect,
            scoreEarned: item.scoreEarned,
            totalScore: item.totalScore
          });
        });
      }
      pendingContestantResults = null; // ensure B2 won't resend old results
    });
  });

  socket.on("admin:reset-session", async (_rawPayload, ack?: AckFn) => {
    await safeHandle(ack, "admin:reset-session", {}, async () => {
      clearRevealRefreshTimer();
      pendingContestantResults = null;
      clearCountdownEnd();
      const state = await contestService.resetSession();
      io.emit("countdown:end", {});
      io.emit("contest:sync-state", { fullState: state, serverNow: Date.now() });
      io.emit("screen:change", { screen: state.screen });
    });
  });
};
