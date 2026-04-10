import { AppDataSource } from "../../config/database";
import { AuditLog } from "../audit/auditLog.entity";
import { ExamSet } from "../exam/examSet.entity";
import { FillBlankAnswer } from "../question/fillBlankAnswer.entity";
import { Option } from "../question/option.entity";
import { Question } from "../question/question.entity";
import { NotFoundError, StateConflictError } from "../../shared/errors/AppError";
import { assertTransition, ContestScreen } from "./contest.stateMachine";
import { ContestState } from "./contestState.entity";
import { ScoringService } from "../scoring/scoring.service";
import { LeaderboardService } from "../leaderboard/leaderboard.service";

type UpdateStateInput = Partial<{
  screen: ContestScreen;
  currentExamSetId: number | null;
  currentQuestionId: number | null;
  isCountdownActive: boolean;
  countdownEndAt: Date | null;
}>;

export class ContestService {
  private contestStateRepo = AppDataSource.getRepository(ContestState);
  private examSetRepo = AppDataSource.getRepository(ExamSet);
  private questionRepo = AppDataSource.getRepository(Question);
  private optionRepo = AppDataSource.getRepository(Option);
  private fillBlankRepo = AppDataSource.getRepository(FillBlankAnswer);
  private auditLogRepo = AppDataSource.getRepository(AuditLog);
  private scoringService = new ScoringService();
  private leaderboardService = new LeaderboardService();

  async getCurrentState(): Promise<ContestState> {
    const state = await this.contestStateRepo.findOne({ where: { id: 1 } });
    if (!state) {
      throw new NotFoundError("Contest state not initialized");
    }
    return state;
  }

  async updateContestState(expectedVersion: number, patch: UpdateStateInput): Promise<ContestState> {
    const result = await this.contestStateRepo
      .createQueryBuilder()
      .update(ContestState)
      .set({
        screen: patch.screen,
        currentExamSetId: patch.currentExamSetId,
        currentQuestionId: patch.currentQuestionId,
        isCountdownActive: patch.isCountdownActive,
        countdownEndAt: patch.countdownEndAt,
        version: () => "version + 1"
      })
      .where("id = :id", { id: 1 })
      .andWhere("version = :version", { version: expectedVersion })
      .execute();

    if (!result.affected) {
      throw new StateConflictError();
    }

    return this.getCurrentState();
  }

  async setScreen(nextScreen: ContestScreen): Promise<ContestState> {
    const current = await this.getCurrentState();
    assertTransition(current.screen, nextScreen);
    return this.updateContestState(current.version, { screen: nextScreen });
  }

  async selectExamSet(examSetId: number): Promise<ContestState> {
    const examSet = await this.examSetRepo.findOne({ where: { id: examSetId } });
    if (!examSet) throw new NotFoundError("Exam set not found");

    const current = await this.getCurrentState();
    return this.updateContestState(current.version, { currentExamSetId: examSetId });
  }

  async showQuestion(questionId: number): Promise<{ state: ContestState; question: Question; options: Option[] }> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");

    const current = await this.getCurrentState();
    assertTransition(current.screen, "question");
    const state = await this.updateContestState(current.version, {
      screen: "question",
      currentQuestionId: questionId,
      currentExamSetId: question.examSetId,
      isCountdownActive: false,
      countdownEndAt: null
    });

    const options = await this.optionRepo.find({ where: { questionId }, order: { orderNum: "ASC" } });
    return { state, question, options };
  }

  async getQuestionDisplayData(questionId: number): Promise<{ question: Question; options: Option[] }> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");
    const options = await this.optionRepo.find({ where: { questionId }, order: { orderNum: "ASC" } });
    return { question, options };
  }

  async startCountdown(questionId: number): Promise<{ state: ContestState; seconds: number; endsAt: number }> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");

    const current = await this.getCurrentState();
    assertTransition(current.screen, "countdown");
    const endsAt = new Date(Date.now() + question.countdownSeconds * 1000);

    const state = await this.updateContestState(current.version, {
      screen: "countdown",
      currentQuestionId: questionId,
      currentExamSetId: question.examSetId,
      isCountdownActive: true,
      countdownEndAt: endsAt
    });

    return { state, seconds: question.countdownSeconds, endsAt: endsAt.getTime() };
  }

  async stopCountdown(): Promise<ContestState> {
    const current = await this.getCurrentState();
    return this.updateContestState(current.version, {
      isCountdownActive: false
    });
  }

  async showAnswer(questionId: number): Promise<{
    state: ContestState;
    questionId: number;
    correctOptionIds: number[];
    fillBlankAnswers: string[];
    stats: Record<string, number>;
    contestantResults: Array<{ contestantId: number; questionId: number; isCorrect: boolean; scoreEarned: number; totalScore: number }>;
  }> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");

    const current = await this.getCurrentState();
    assertTransition(current.screen, "reveal");
    const state = await this.updateContestState(current.version, {
      screen: "reveal",
      isCountdownActive: false
    });

    const options = await this.optionRepo.find({ where: { questionId, isCorrect: true } });
    const fillBlankAnswers = await this.fillBlankRepo.find({ where: { questionId } });
    const scoring = await this.scoringService.scoreAll(questionId);

    return {
      state,
      questionId,
      correctOptionIds: options.map((o) => o.id),
      fillBlankAnswers: fillBlankAnswers.map((f) => f.acceptedAnswer),
      stats: scoring.stats,
      contestantResults: scoring.contestantResults
    };
  }

  async showTeamScore(examSetId: number): Promise<{ state: ContestState; examSetId: number; teams: unknown[] }> {
    const examSet = await this.examSetRepo.findOne({ where: { id: examSetId } });
    if (!examSet) throw new NotFoundError("Exam set not found");
    const current = await this.getCurrentState();
    assertTransition(current.screen, "team_score");
    const state = await this.updateContestState(current.version, { screen: "team_score" });
    const teams = await this.leaderboardService.getTeamScores(examSetId);
    return { state, examSetId, teams };
  }

  async showLeaderboard(): Promise<{ state: ContestState; rankings: Array<{ rank: number; contestantId: number; name: string; teamId: number; team: string; totalScore: number }> }> {
    const current = await this.getCurrentState();
    assertTransition(current.screen, "leaderboard");
    const state = await this.updateContestState(current.version, { screen: "leaderboard" });
    const rankings = await this.leaderboardService.getFinalRankings();
    return { state, rankings };
  }

  async markCountdownEnded(): Promise<ContestState> {
    const current = await this.getCurrentState();
    if (current.screen !== "countdown") {
      return current;
    }
    return this.updateContestState(current.version, { isCountdownActive: false });
  }

  async resetSession(): Promise<ContestState> {
    const current = await this.getCurrentState();
    return this.updateContestState(current.version, {
      screen: "idle",
      currentQuestionId: null,
      isCountdownActive: false,
      countdownEndAt: null
    });
  }

  async writeAudit(actor: string, action: string, payload?: Record<string, unknown>): Promise<void> {
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        actor,
        action,
        payload: payload ?? null
      })
    );
  }
}
