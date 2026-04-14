import bcrypt from "bcrypt";
import { AppDataSource } from "../../config/database";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError";
import { Contestant } from "./contestant.entity";
import { Team } from "../team/team.entity";
import { Answer } from "../submission/answer.entity";

export class ContestantService {
  private contestantRepo = AppDataSource.getRepository(Contestant);
  private teamRepo = AppDataSource.getRepository(Team);

  async list(teamId?: number): Promise<Contestant[]> {
    if (teamId) {
      return this.contestantRepo.find({ where: { teamId } });
    }
    return this.contestantRepo.find();
  }

  async create(input: {
    teamId: number | null;
    code: string;
    password: string;
    name: string;
    unit?: string | null;
  }): Promise<Contestant> {
    if (input.teamId !== null) {
      await this.ensureTeamExists(input.teamId);
    }
    const existed = await this.contestantRepo.findOne({ where: { code: input.code } });
    if (existed) {
      throw new ConflictError("Contestant code already exists");
    }
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const contestant = this.contestantRepo.create({
      teamId: input.teamId,
      code: input.code,
      password: hashedPassword,
      name: input.name,
      unit: input.unit ?? null,
      totalScore: 0,
      isOnline: false
    });
    return this.contestantRepo.save(contestant);
  }

  async update(
    id: number,
    input: { teamId?: number | null; code?: string; password?: string; name?: string; unit?: string | null }
  ): Promise<Contestant> {
    const contestant = await this.contestantRepo.findOne({ where: { id } });
    if (!contestant) {
      throw new NotFoundError("Contestant not found");
    }

    if (input.teamId !== undefined) {
      if (input.teamId !== null) {
        await this.ensureTeamExists(input.teamId);
      }
      contestant.teamId = input.teamId;
    }

    if (input.code && input.code !== contestant.code) {
      const existed = await this.contestantRepo.findOne({ where: { code: input.code } });
      if (existed) {
        throw new ConflictError("Contestant code already exists");
      }
      contestant.code = input.code;
    }

    if (input.password) {
      contestant.password = await bcrypt.hash(input.password, 10);
    }
    if (input.name !== undefined) {
      contestant.name = input.name;
    }
    if (input.unit !== undefined) {
      contestant.unit = input.unit;
    }

    return this.contestantRepo.save(contestant);
  }

  async remove(id: number): Promise<void> {
    const contestant = await this.contestantRepo.findOne({ where: { id } });
    if (!contestant) {
      throw new NotFoundError("Contestant not found");
    }
    await this.contestantRepo.remove(contestant);
  }

  async getHistoryByContestant(id: number): Promise<
    Array<{
      examSetId: number;
      examSetName: string;
      totalScore: number;
      submittedCount: number;
      correctCount: number;
      questions: Array<{
        questionId: number;
        questionContent: string;
        isCorrect: boolean | null;
        scoreEarned: number;
        submittedAt: string;
      }>;
    }>
  > {
    const contestant = await this.contestantRepo.findOne({ where: { id } });
    if (!contestant) throw new NotFoundError("Contestant not found");

    const rows = await AppDataSource.getRepository(Answer)
      .createQueryBuilder("a")
      .innerJoin("exam_sets", "es", "es.id = a.exam_set_id")
      .innerJoin("questions", "q", "q.id = a.question_id")
      .select("a.exam_set_id", "examSetId")
      .addSelect("es.name", "examSetName")
      .addSelect("a.question_id", "questionId")
      .addSelect("q.content", "questionContent")
      .addSelect("a.is_correct", "isCorrect")
      .addSelect("COALESCE(a.score_earned, 0)", "scoreEarned")
      .addSelect("a.submitted_at", "submittedAt")
      .where("a.contestant_id = :contestantId", { contestantId: id })
      .orderBy("a.exam_set_id", "DESC")
      .addOrderBy("a.submitted_at", "DESC")
      .getRawMany<{
        examSetId: string;
        examSetName: string;
        questionId: string;
        questionContent: string;
        isCorrect: number | null;
        scoreEarned: string;
        submittedAt: string;
      }>();

    const grouped = new Map<number, {
      examSetId: number;
      examSetName: string;
      totalScore: number;
      submittedCount: number;
      correctCount: number;
      questions: Array<{
        questionId: number;
        questionContent: string;
        isCorrect: boolean | null;
        scoreEarned: number;
        submittedAt: string;
      }>;
    }>();

    rows.forEach((row) => {
      const examSetId = Number(row.examSetId);
      if (!grouped.has(examSetId)) {
        grouped.set(examSetId, {
          examSetId,
          examSetName: row.examSetName,
          totalScore: 0,
          submittedCount: 0,
          correctCount: 0,
          questions: []
        });
      }
      const bucket = grouped.get(examSetId)!;
      const scoreEarned = Number(row.scoreEarned) || 0;
      const isCorrect = row.isCorrect === null ? null : Boolean(row.isCorrect);
      bucket.totalScore += scoreEarned;
      bucket.submittedCount += 1;
      bucket.correctCount += isCorrect ? 1 : 0;
      bucket.questions.push({
        questionId: Number(row.questionId),
        questionContent: row.questionContent,
        isCorrect,
        scoreEarned,
        submittedAt: row.submittedAt
      });
    });

    return Array.from(grouped.values());
  }

  private async ensureTeamExists(teamId: number): Promise<void> {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundError("Team not found");
    }
  }
}
