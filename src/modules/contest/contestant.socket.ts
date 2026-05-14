import { Server, Socket } from "socket.io";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { SubmissionService } from "../submission/submission.service";
import { submitAnswerSchema } from "../submission/submission.validator";

type AckFn = (response: { success: boolean; message?: string }) => void;

export const registerContestantSocketHandlers = (_io: Server, socket: Socket, submissionService: SubmissionService): void => {
  const contestantId = socket.data.user?.contestantId as number | undefined;
  if (contestantId) {
    socket.join(`contestant:${contestantId}`);
  }

  socket.on("contestant:submit-answer", async (rawPayload, ack?: AckFn) => {
    const parsed = submitAnswerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      ack?.({
        success: false,
        message: parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; ")
      });
      return;
    }
    if (!contestantId) {
      ack?.({ success: false, message: "Contestant identity missing" });
      return;
    }

    try {
      const result = await submissionService.submit({
        contestantId,
        questionId: parsed.data.questionId,
        selectedOptionIds: parsed.data.selectedOptionIds,
        fillText: parsed.data.fillText
      });
      socket.emit("contestant:answer-received", result);
      ack?.({ success: true });
    } catch (error) {
      logger.warn({ error }, "Contestant submit failed");
      const message = error instanceof AppError ? error.message : "Internal error";
      ack?.({ success: false, message });
    }
  });

  socket.on("contestant:auto-save-answer", async (rawPayload, ack?: AckFn) => {
    const parsed = submitAnswerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      ack?.({
        success: false,
        message: parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; ")
      });
      return;
    }
    if (!contestantId) {
      ack?.({ success: false, message: "Contestant identity missing" });
      return;
    }

    try {
      await submissionService.submit({
        contestantId,
        questionId: parsed.data.questionId,
        selectedOptionIds: parsed.data.selectedOptionIds,
        fillText: parsed.data.fillText
      });
      ack?.({ success: true });
    } catch (error) {
      logger.warn({ error }, "Contestant auto-save failed");
      const message = error instanceof AppError ? error.message : "Internal error";
      ack?.({ success: false, message });
    }
  });
};
