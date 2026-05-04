import bcrypt from "bcrypt";
import * as XLSX from "xlsx";
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

  async bulkAssignTeam(contestantIds: number[], teamId: number | null): Promise<void> {
    if (teamId !== null) {
      await this.ensureTeamExists(teamId);
    }
    await this.contestantRepo
      .createQueryBuilder()
      .update(Contestant)
      .set({ teamId })
      .where("id IN (:...contestantIds)", { contestantIds })
      .execute();
  }

  async importFromSpreadsheet(
    rows: Array<{ code: string; name: string; password: string; unit?: string | null; teamName?: string | null }>
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const teams = await this.teamRepo.find();
    const teamByName = new Map(teams.map((t) => [t.name.trim().toLowerCase(), t.id]));

    for (const row of rows) {
      const code = row.code?.trim();
      const name = row.name?.trim();
      const password = row.password?.trim();
      if (!code || !name || !password) {
        skipped++;
        continue;
      }
      const existed = await this.contestantRepo.findOne({ where: { code } });
      if (existed) {
        skipped++;
        continue;
      }
      let teamId: number | null = null;
      const tn = row.teamName?.trim();
      if (tn) {
        const key = tn.toLowerCase();
        let tid = teamByName.get(key);
        if (!tid) {
          const createdTeam = await this.teamRepo.save(
            this.teamRepo.create({
              name: tn,
              description: "Tạo tự động từ import Excel"
            })
          );
          tid = createdTeam.id;
          teamByName.set(key, tid);
        }
        teamId = tid;
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await this.contestantRepo.save(
        this.contestantRepo.create({
          teamId,
          code,
          password: hashedPassword,
          name,
          unit: row.unit?.trim() || null,
          totalScore: 0,
          isOnline: false
        })
      );
      created++;
    }
    return { created, skipped };
  }

  async importFromExcelBuffer(buffer: Buffer): Promise<{ created: number; skipped: number }> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const first = wb.SheetNames[0];
    if (!first) {
      return { created: 0, skipped: 0 };
    }
    const sheet = wb.Sheets[first];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const rows = json.map((r) => {
      const pick = (keys: string[]): string => {
        for (const k of keys) {
          if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
            return String(r[k]).trim();
          }
        }
        return "";
      };
      return {
        code: pick(["Mã", "ma", "Ma", "code", "Code", "CODE"]),
        name: pick(["Tên", "ten", "Ten", "name", "Name", "NAME"]),
        password: pick(["Mật khẩu", "mat_khau", "Mat_khau", "password", "Password", "PASSWORD"]),
        unit: pick(["Đơn vị", "don_vi", "Don_vi", "unit", "Unit"]) || null,
        teamName: pick(["Đội", "doi", "Doi", "team", "Team", "Tên đội"]) || null
      };
    });
    return this.importFromSpreadsheet(rows);
  }

  async getHistoryByContestant(id: number): Promise<
    Array<{
      sessionId: number;
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
      .addSelect("a.session_id", "sessionId")
      .addSelect("es.name", "examSetName")
      .addSelect("a.question_id", "questionId")
      .addSelect("q.content", "questionContent")
      .addSelect("a.is_correct", "isCorrect")
      .addSelect("COALESCE(a.score_earned, 0)", "scoreEarned")
      .addSelect("a.submitted_at", "submittedAt")
      .where("a.contestant_id = :contestantId", { contestantId: id })
      .orderBy("a.session_id", "DESC")
      .addOrderBy("a.exam_set_id", "DESC")
      .addOrderBy("a.submitted_at", "DESC")
      .getRawMany<{
        sessionId: string;
        examSetId: string;
        examSetName: string;
        questionId: string;
        questionContent: string;
        isCorrect: number | null;
        scoreEarned: string;
        submittedAt: string;
      }>();

    const grouped = new Map<string, {
      sessionId: number;
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
      const sessionId = Number(row.sessionId);
      const examSetId = Number(row.examSetId);
      const key = `${sessionId}:${examSetId}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          sessionId,
          examSetId,
          examSetName: row.examSetName,
          totalScore: 0,
          submittedCount: 0,
          correctCount: 0,
          questions: []
        });
      }
      const bucket = grouped.get(key)!;
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
