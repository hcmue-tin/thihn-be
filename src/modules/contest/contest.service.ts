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
  currentSessionId: number;
  isCountdownActive: boolean;
  countdownEndAt: Date | null;
  rulesContent: string | null;
  backgroundUrl: string | null;
  ledBackgroundUrl: string | null;
  ledWaitingBackgroundUrl: string | null;
  contestantBackgroundUrl: string | null;
  activeTeamId: number | null;
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

  private async getQuestionById(questionId: number): Promise<Question> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");
    return question;
  }

  private async ensureContestStateExists(): Promise<ContestState> {
    let state = await this.contestStateRepo.findOne({ where: { id: 1 } });
    if (!state) {
      state = await this.contestStateRepo.save(
        this.contestStateRepo.create({
          id: 1,
          screen: "idle",
          currentExamSetId: null,
          currentQuestionId: null,
          currentSessionId: 1,
          isCountdownActive: false,
          countdownEndAt: null,
          rulesContent: null,
          backgroundUrl: null,
          ledBackgroundUrl: null,
          ledWaitingBackgroundUrl: null,
          contestantBackgroundUrl: null,
          activeTeamId: null,
          version: 0
        })
      );
    }
    return state;
  }

  async updateContestState(expectedVersion: number, patch: UpdateStateInput): Promise<ContestState> {
    const setPayload: Record<string, unknown> = { version: () => "version + 1" };
    if (patch.screen !== undefined) setPayload.screen = patch.screen;
    if (patch.currentExamSetId !== undefined) setPayload.currentExamSetId = patch.currentExamSetId;
    if (patch.currentQuestionId !== undefined) setPayload.currentQuestionId = patch.currentQuestionId;
    if (patch.currentSessionId !== undefined) setPayload.currentSessionId = patch.currentSessionId;
    if (patch.isCountdownActive !== undefined) setPayload.isCountdownActive = patch.isCountdownActive;
    if (patch.countdownEndAt !== undefined) setPayload.countdownEndAt = patch.countdownEndAt;
    if (patch.rulesContent !== undefined) setPayload.rulesContent = patch.rulesContent;
    if (patch.backgroundUrl !== undefined) setPayload.backgroundUrl = patch.backgroundUrl;
    if (patch.ledBackgroundUrl !== undefined) setPayload.ledBackgroundUrl = patch.ledBackgroundUrl;
    if (patch.ledWaitingBackgroundUrl !== undefined) setPayload.ledWaitingBackgroundUrl = patch.ledWaitingBackgroundUrl;
    if (patch.contestantBackgroundUrl !== undefined) setPayload.contestantBackgroundUrl = patch.contestantBackgroundUrl;
    if (patch.activeTeamId !== undefined) setPayload.activeTeamId = patch.activeTeamId;

    const result = await this.contestStateRepo
      .createQueryBuilder()
      .update(ContestState)
      .set(setPayload)
      .where("id = :id", { id: 1 })
      .andWhere("version = :version", { version: expectedVersion })
      .execute();

    if (!result.affected) {
      throw new StateConflictError();
    }

    return this.getCurrentState();
  }

  async setScreen(nextScreen: ContestScreen, opts?: { activeTeamId?: number | null }): Promise<ContestState> {
    const current = await this.getCurrentState();
    assertTransition(current.screen, nextScreen);
    const patch: UpdateStateInput = { screen: nextScreen };
    if (opts && "activeTeamId" in opts) {
      patch.activeTeamId = opts.activeTeamId ?? null;
    }
    return this.updateContestState(current.version, patch);
  }

  async selectExamSet(examSetId: number): Promise<ContestState> {
    const examSet = await this.examSetRepo.findOne({ where: { id: examSetId } });
    if (!examSet) throw new NotFoundError("Exam set not found");

    const current = await this.getCurrentState();
    return this.updateContestState(current.version, { currentExamSetId: examSetId });
  }

  async showQuestion(
    questionId: number,
    opts?: { activeTeamId?: number | null }
  ): Promise<{ state: ContestState; question: Question; options: Option[] }> {
    const question = await this.getQuestionById(questionId);

    const current = await this.getCurrentState();
    assertTransition(current.screen, "question");
    const state = await this.updateContestState(current.version, {
      screen: "question",
      currentQuestionId: questionId,
      currentExamSetId: question.examSetId,
      isCountdownActive: false,
      countdownEndAt: null,
      ...(opts && "activeTeamId" in opts ? { activeTeamId: opts.activeTeamId ?? null } : {})
    });

    const options = await this.optionRepo.find({ where: { questionId }, order: { orderNum: "ASC" } });
    return { state, question, options };
  }

  async getQuestionDisplayData(questionId: number): Promise<{ question: Question; options: Option[] }> {
    const question = await this.getQuestionById(questionId);
    const options = await this.optionRepo.find({ where: { questionId }, order: { orderNum: "ASC" } });
    return { question, options };
  }

  async startCountdown(questionId: number, opts?: { activeTeamId?: number | null }): Promise<{ state: ContestState; seconds: number; endsAt: number }> {
    const question = await this.getQuestionById(questionId);

    const current = await this.getCurrentState();
    assertTransition(current.screen, "countdown");
    const endsAt = new Date(Date.now() + question.countdownSeconds * 1000);

    const state = await this.updateContestState(current.version, {
      screen: "countdown",
      currentQuestionId: questionId,
      currentExamSetId: question.examSetId,
      isCountdownActive: true,
      countdownEndAt: endsAt,
      ...(opts && "activeTeamId" in opts ? { activeTeamId: opts.activeTeamId ?? null } : {})
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
    const question = await this.getQuestionById(questionId);

    const current = await this.getCurrentState();
    assertTransition(current.screen, "reveal");
    const state = await this.updateContestState(current.version, {
      screen: "reveal",
      isCountdownActive: false
    });

    const options = await this.optionRepo.find({ where: { questionId, isCorrect: true } });
    const fillBlankAnswers = await this.fillBlankRepo.find({ where: { questionId } });
    const scoring = await this.scoringService.scoreAll(questionId, state.currentSessionId);

    return {
      state,
      questionId,
      correctOptionIds: options.map((o) => o.id),
      fillBlankAnswers: fillBlankAnswers.map((f) => f.acceptedAnswer),
      stats: scoring.stats,
      contestantResults: scoring.contestantResults
    };
  }

  async showTeamScore(
    examSetId: number,
    teamIds?: number[],
    opts?: { activeTeamId?: number | null }
  ): Promise<{ state: ContestState; examSetId: number; teams: unknown[] }> {
    const examSet = await this.examSetRepo.findOne({ where: { id: examSetId } });
    if (!examSet) throw new NotFoundError("Exam set not found");
    const current = await this.getCurrentState();
    assertTransition(current.screen, "team_score");
    const state = await this.updateContestState(current.version, {
      screen: "team_score",
      ...(opts && "activeTeamId" in opts ? { activeTeamId: opts.activeTeamId ?? null } : {})
    });
    const teams = await this.leaderboardService.getTeamScores(examSetId, teamIds, state.currentSessionId);
    return { state, examSetId, teams };
  }

  async showLeaderboard(
    teamIds?: number[],
    opts?: { activeTeamId?: number | null }
  ): Promise<{ state: ContestState; rankings: Array<{ rank: number; contestantId: number; name: string; teamId: number; team: string; totalScore: number }> }> {
    const current = await this.getCurrentState();
    assertTransition(current.screen, "leaderboard");
    const state = await this.updateContestState(current.version, {
      screen: "leaderboard",
      ...(opts && "activeTeamId" in opts ? { activeTeamId: opts.activeTeamId ?? null } : {})
    });
    const rankings = await this.leaderboardService.getFinalRankings(teamIds, state.currentSessionId);
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
    await this.ensureContestStateExists();
    const current = await this.getCurrentState();
    return this.updateContestState(current.version, {
      screen: "idle",
      currentQuestionId: null,
      currentSessionId: current.currentSessionId + 1,
      isCountdownActive: false,
      countdownEndAt: null
    });
  }

  async setActiveTeam(activeTeamId: number | null): Promise<ContestState> {
    await this.ensureContestStateExists();
    const current = await this.getCurrentState();
    return this.updateContestState(current.version, { activeTeamId });
  }

  async getRulesContent(): Promise<string | null> {
    const state = await this.ensureContestStateExists();
    return state.rulesContent ?? null;
  }

  async updateRulesContent(rulesContent: string): Promise<ContestState> {
    await this.ensureContestStateExists();
    const current = await this.getCurrentState();
    return this.updateContestState(current.version, { rulesContent });
  }

  async updateDisplayConfig(input: {
    rulesContent: string;
    backgroundUrl?: string | null;
    ledBackgroundUrl?: string | null;
    ledWaitingBackgroundUrl?: string | null;
    contestantBackgroundUrl?: string | null;
  }): Promise<ContestState> {
    await this.ensureContestStateExists();
    const current = await this.getCurrentState();
    const patch: UpdateStateInput = { rulesContent: input.rulesContent };
    if (input.ledBackgroundUrl !== undefined) {
      patch.ledBackgroundUrl = input.ledBackgroundUrl;
    }
    if (input.ledWaitingBackgroundUrl !== undefined) {
      patch.ledWaitingBackgroundUrl = input.ledWaitingBackgroundUrl;
    }
    if (input.contestantBackgroundUrl !== undefined) {
      patch.contestantBackgroundUrl = input.contestantBackgroundUrl;
    }
    if (input.backgroundUrl !== undefined) {
      patch.backgroundUrl = input.backgroundUrl;
      if (input.ledBackgroundUrl === undefined) patch.ledBackgroundUrl = input.backgroundUrl;
      if (input.contestantBackgroundUrl === undefined) patch.contestantBackgroundUrl = input.backgroundUrl;
    }
    return this.updateContestState(current.version, patch);
  }

  async retakeQuestion(questionId: number, sessionId: number): Promise<void> {
    const question = await this.getQuestionById(questionId);

    const contestantRows = await AppDataSource.createQueryBuilder()
      .select("a.contestant_id", "contestantId")
      .from("answers", "a")
      .where("a.question_id = :questionId", { questionId })
      .andWhere("a.exam_set_id = :examSetId", { examSetId: question.examSetId })
      .groupBy("a.contestant_id")
      .getRawMany<{ contestantId: string }>();

    const contestantIds = contestantRows.map((row) => Number(row.contestantId));

    await AppDataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from("answers")
        .where("question_id = :questionId", { questionId })
        .andWhere("exam_set_id = :examSetId", { examSetId: question.examSetId })
        .andWhere("session_id = :sessionId", { sessionId })
        .execute();

      if (contestantIds.length === 0) {
        return;
      }

      const totals = await manager
        .createQueryBuilder()
        .select("a.contestant_id", "contestantId")
        .addSelect("COALESCE(SUM(a.score_earned), 0)", "totalScore")
        .from("answers", "a")
        .where("a.contestant_id IN (:...contestantIds)", { contestantIds })
        .andWhere("a.exam_set_id = :examSetId", { examSetId: question.examSetId })
        .andWhere("a.session_id = :sessionId", { sessionId })
        .groupBy("a.contestant_id")
        .getRawMany<{ contestantId: string; totalScore: string }>();

      const totalMap = new Map<number, number>(totals.map((row) => [Number(row.contestantId), Number(row.totalScore)]));
      const totalCase = contestantIds.map((id) => `WHEN ${id} THEN ${totalMap.get(id) ?? 0}`).join(" ");
      await manager.query(
        `UPDATE contestants
         SET total_score = CASE id ${totalCase} ELSE total_score END
         WHERE id IN (${contestantIds.join(",")})`
      );
    });
  }

  async getTeamList(teamIds?: number[] | null): Promise<Array<{ id: number; name: string; contestants: Array<{ id: number; name: string; code: string; unit: string | null }> }>> {
    if (teamIds !== undefined && teamIds !== null && teamIds.length === 0) {
      return [];
    }

    let qb = AppDataSource.createQueryBuilder()
      .select("t.id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("c.code", "contestantCode")
      .addSelect("c.unit", "contestantUnit")
      .from("teams", "t")
      .leftJoin("contestants", "c", "c.team_id = t.id")
      .orderBy("t.id", "ASC")
      .addOrderBy("c.name", "ASC");

    if (teamIds && teamIds.length > 0) {
      qb = qb.where("t.id IN (:...teamIds)", { teamIds });
    }

    const rows = await qb.getRawMany<{
      teamId: string;
      teamName: string;
      contestantId: string | null;
      contestantName: string | null;
      contestantCode: string | null;
      contestantUnit: string | null;
    }>();

    const grouped = new Map<number, { id: number; name: string; contestants: Array<{ id: number; name: string; code: string; unit: string | null }> }>();
    for (const row of rows) {
      const teamId = Number(row.teamId);
      if (!grouped.has(teamId)) {
        grouped.set(teamId, { id: teamId, name: row.teamName, contestants: [] });
      }
      if (row.contestantId) {
        grouped.get(teamId)!.contestants.push({
          id: Number(row.contestantId),
          name: row.contestantName ?? "",
          code: row.contestantCode ?? "",
          unit: row.contestantUnit
        });
      }
    }
    return [...grouped.values()];
  }

  async getActiveTeamFilter(): Promise<number[] | null> {
    const state = await this.getCurrentState();
    return state.activeTeamId != null ? [state.activeTeamId] : null;
  }

  async getAnswerResultsForQuestion(
    questionId: number,
    filterTeamIds?: number[] | null,
    sessionId?: number
  ): Promise<
    Array<{
      contestantId: number;
      contestantName: string;
      teamName: string;
      hasSubmitted: boolean;
      isCorrect: boolean | null;
      scoreEarned: number;
      answerSummary: string | null;
    }>
  > {
    const effectiveSessionId = sessionId ?? (await this.getCurrentState()).currentSessionId;

    let qb = AppDataSource.createQueryBuilder()
      .select("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("COALESCE(t.name, 'Chưa có đội')", "teamName")
      .addSelect("c.team_id", "teamId")
      .addSelect("a.id", "answerId")
      .addSelect("a.submitted_at", "submittedAt")
      .addSelect("a.is_correct", "isCorrect")
      .addSelect("COALESCE(a.score_earned, 0)", "scoreEarned")
      .addSelect("a.fill_text", "fillText")
      .addSelect("a.selected_option_ids", "selectedOptionIds")
      .from("contestants", "c")
      .leftJoin("teams", "t", "t.id = c.team_id")
      .leftJoin(
        "answers",
        "a",
        "a.contestant_id = c.id AND a.question_id = :questionId AND a.session_id = :sessionId",
        { questionId, sessionId: effectiveSessionId }
      )
      .orderBy("c.name", "ASC");

    if (filterTeamIds !== undefined && filterTeamIds !== null && filterTeamIds.length > 0) {
      qb = qb.andWhere("c.team_id IN (:...filterTeamIds)", { filterTeamIds });
    }

    const rows = await qb.getRawMany<{
      contestantId: string;
      contestantName: string;
      teamName: string;
      teamId: string | null;
      answerId: string | null;
      submittedAt: string | null;
      isCorrect: number | boolean | null;
      scoreEarned: string;
      fillText: string | null;
      selectedOptionIds: string | number[] | null;
    }>();

    const options = await this.optionRepo.find({ where: { questionId }, order: { orderNum: "ASC" } });
    const idToLabel = new Map(options.map((o) => [o.id, o.label]));

    const formatSummary = (fillText: string | null, rawSelected: string | number[] | null): string | null => {
      const text = fillText?.trim();
      if (text) return text;
      let ids: number[] = [];
      if (Array.isArray(rawSelected)) {
        ids = rawSelected.map(Number);
      } else if (typeof rawSelected === "string" && rawSelected.trim()) {
        try {
          const parsed = JSON.parse(rawSelected) as unknown;
          if (Array.isArray(parsed)) ids = parsed.map(Number);
        } catch {
          return null;
        }
      }
      if (ids.length === 0) return null;
      const labels = ids.map((id) => idToLabel.get(id) ?? "?").join(", ");
      return labels;
    };

    return rows.map((row) => ({
      contestantId: Number(row.contestantId),
      contestantName: row.contestantName,
      teamName: row.teamName,
      hasSubmitted: row.answerId !== null || row.submittedAt !== null,
      isCorrect: row.isCorrect === null ? null : Boolean(row.isCorrect),
      scoreEarned: Number(row.scoreEarned),
      answerSummary: formatSummary(row.fillText, row.selectedOptionIds)
    }));
  }

  async recomputeRevealResults(
    questionId: number,
    filterTeamIds?: number[] | null,
    sessionId?: number
  ): Promise<{
    contestantResults: Array<{ contestantId: number; questionId: number; isCorrect: boolean; scoreEarned: number; totalScore: number }>;
    answerRows: Array<{
      contestantId: number;
      contestantName: string;
      teamName: string;
      hasSubmitted: boolean;
      isCorrect: boolean | null;
      scoreEarned: number;
      answerSummary: string | null;
    }>;
  }> {
    const effectiveSessionId = sessionId ?? (await this.getCurrentState()).currentSessionId;
    const scoring = await this.scoringService.scoreAll(questionId, effectiveSessionId);
    const answerRows = await this.getAnswerResultsForQuestion(questionId, filterTeamIds, effectiveSessionId);
    return { contestantResults: scoring.contestantResults, answerRows };
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
