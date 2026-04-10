import { AppDataSource } from "../../config/database";
import { AppError } from "../../shared/errors/AppError";
import { ContestState } from "../contest/contestState.entity";
import { Answer } from "./answer.entity";

type SubmitInput = {
  contestantId: number;
  questionId: number;
  selectedOptionIds?: number[];
  fillText?: string;
};

export class SubmissionService {
  private contestStateRepo = AppDataSource.getRepository(ContestState);
  private answerRepo = AppDataSource.getRepository(Answer);

  async submit(input: SubmitInput): Promise<{ questionId: number; timestamp: number }> {
    const state = await this.contestStateRepo.findOne({ where: { id: 1 } });
    if (!state) {
      throw new AppError("Contest state not initialized", 500);
    }

    if (state.screen !== "countdown" || !state.isCountdownActive || !state.countdownEndAt) {
      throw new AppError("Submission is not allowed now", 400);
    }

    if (state.currentQuestionId !== input.questionId) {
      throw new AppError("Question is not active", 400);
    }

    const submittedAt = new Date();
    if (submittedAt.getTime() > new Date(state.countdownEndAt).getTime()) {
      throw new AppError("Time is up", 400);
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
