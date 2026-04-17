import { AppDataSource } from "../../config/database";
import { AppError } from "../../shared/errors/AppError";
import { ContestState } from "../contest/contestState.entity";
import { Contestant } from "../contestant/contestant.entity";
import { Answer } from "./answer.entity";

type SubmitInput = {
  contestantId: number;
  questionId: number;
  selectedOptionIds?: number[];
  fillText?: string;
};

export class SubmissionService {
  private contestStateRepo = AppDataSource.getRepository(ContestState);
  private contestantRepo = AppDataSource.getRepository(Contestant);
  private answerRepo = AppDataSource.getRepository(Answer);
  private readonly revealAutoSubmitGraceMs = 3000;

  async submit(input: SubmitInput): Promise<{ questionId: number; timestamp: number }> {
    const state = await this.contestStateRepo.findOne({ where: { id: 1 } });
    if (!state) {
      throw new AppError("Contest state not initialized", 500);
    }

    const submittedAt = new Date();
    const submittedAtMs = submittedAt.getTime();
    const countdownDeadlineMs = state.countdownEndAt ? new Date(state.countdownEndAt).getTime() : null;
    const revealDeadlineMs =
      state.screen === "reveal" && state.updatedAt
        ? new Date(state.updatedAt).getTime() + this.revealAutoSubmitGraceMs
        : null;
    const canSubmitDuringCountdown =
      state.screen === "countdown" && state.isCountdownActive && countdownDeadlineMs != null && submittedAtMs <= countdownDeadlineMs;
    const canSubmitRightAfterReveal = state.screen === "reveal" && revealDeadlineMs != null && submittedAtMs <= revealDeadlineMs;

    if (!canSubmitDuringCountdown && !canSubmitRightAfterReveal) {
      throw new AppError("Submission is not allowed now", 400);
    }

    if (state.currentQuestionId !== input.questionId) {
      throw new AppError("Question is not active", 400);
    }

    if (state.activeTeamId != null) {
      const contestant = await this.contestantRepo.findOne({ where: { id: input.contestantId } });
      if (!contestant) {
        throw new AppError("Contestant not found", 404);
      }
      if (contestant.teamId !== state.activeTeamId) {
        throw new AppError("Current round is not for your team", 403);
      }
    }

    const existing = await this.answerRepo.findOne({
      where: {
        contestantId: input.contestantId,
        questionId: input.questionId
      }
    });

    if (existing) {
      existing.selectedOptionIds = input.selectedOptionIds ?? null;
      existing.fillText = input.fillText ?? null;
      existing.submittedAt = submittedAt;
      existing.examSetId = state.currentExamSetId as number;
      existing.isCorrect = null;
      existing.scoreEarned = null;
      await this.answerRepo.save(existing);
    } else {
      await this.answerRepo.insert({
        contestantId: input.contestantId,
        questionId: input.questionId,
        selectedOptionIds: input.selectedOptionIds ?? null,
        fillText: input.fillText ?? null,
        isCorrect: null,
        scoreEarned: null,
        submittedAt,
        examSetId: state.currentExamSetId as number
      });
    }

    return {
      questionId: input.questionId,
      timestamp: submittedAt.getTime()
    };
  }
}
