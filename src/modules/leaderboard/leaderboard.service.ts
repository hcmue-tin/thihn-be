import { AppDataSource } from "../../config/database";
import { Answer } from "../submission/answer.entity";
import { Contestant } from "../contestant/contestant.entity";
import { ContestState } from "../contest/contestState.entity";
import { ContestSession } from "../contest/contestSession.entity";
import ExcelJS from "exceljs";

type TeamScoreItem = {
  teamId: number;
  name: string;
  totalScore: number;
  contestants: Array<{ contestantId: number; name: string; score: number }>;
};

export class LeaderboardService {
  async getTeamScores(examSetId: number, teamIds?: number[]): Promise<TeamScoreItem[]> {
    let qb = AppDataSource.createQueryBuilder()
      .select("t.id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("COALESCE(SUM(a.score_earned), 0)", "score")
      .from("teams", "t")
      .innerJoin("contestants", "c", "c.team_id = t.id")
      .leftJoin(
        "answers",
        "a",
        "a.contestant_id = c.id AND a.exam_set_id = :examSetId",
        { examSetId }
      );

    if (teamIds && teamIds.length > 0) {
      qb = qb.andWhere("t.id IN (:...teamIds)", { teamIds });
    }

    const rows = await qb
      .groupBy("t.id")
      .addGroupBy("t.name")
      .addGroupBy("c.id")
      .addGroupBy("c.name")
      .getRawMany<{
        teamId: string;
        teamName: string;
        contestantId: string;
        contestantName: string;
        score: string;
      }>();

    const grouped = new Map<number, TeamScoreItem>();
    for (const row of rows) {
      const teamId = Number(row.teamId);
      const score = Number(row.score);
      if (!grouped.has(teamId)) {
        grouped.set(teamId, {
          teamId,
          name: row.teamName,
          totalScore: 0,
          contestants: []
        });
      }
      const team = grouped.get(teamId)!;
      team.totalScore += score;
      team.contestants.push({
        contestantId: Number(row.contestantId),
        name: row.contestantName,
        score
      });
    }

    return [...grouped.values()].sort((a, b) => b.totalScore - a.totalScore);
  }

  async getFinalRankings(
    teamIds?: number[]
  ): Promise<Array<{ rank: number; contestantId: number; name: string; teamId: number; team: string; totalScore: number }>> {
    let qb = AppDataSource.getRepository(Contestant)
      .createQueryBuilder("c")
      .innerJoin("teams", "t", "t.id = c.team_id")
      .leftJoin(
        "answers",
        "a",
        "a.contestant_id = c.id"
      )
      .select("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("c.team_id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("COALESCE(SUM(a.score_earned), 0)", "totalScore");

    if (teamIds && teamIds.length > 0) {
      qb = qb.where("t.id IN (:...teamIds)", { teamIds });
    }

    const rows = await qb
      .groupBy("c.id")
      .addGroupBy("c.name")
      .addGroupBy("c.team_id")
      .addGroupBy("t.name")
      .orderBy("totalScore", "DESC")
      .addOrderBy("c.id", "ASC")
      .getRawMany<{ contestantId: string; contestantName: string; teamId: string; teamName: string; totalScore: string }>();

    const limited = rows.slice(0, 20);
    return limited.map((row, index) => ({
      rank: index + 1,
      contestantId: Number(row.contestantId),
      name: row.contestantName,
      teamId: Number(row.teamId),
      team: row.teamName,
      totalScore: Number(row.totalScore)
    }));
  }

  async getAvailableSessions(): Promise<Array<{ sessionId: number; teamId: number; teamName: string; createdAt: string }>> {
    const rows = await AppDataSource.getRepository(ContestSession)
      .createQueryBuilder("cs")
      .innerJoin("teams", "t", "t.id = cs.team_id")
      .select("cs.id", "sessionId")
      .addSelect("cs.team_id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("cs.created_at", "createdAt")
      .orderBy("cs.id", "DESC")
      .getRawMany<{ sessionId: number; teamId: number; teamName: string; createdAt: Date }>();

    return rows.map((r) => ({
      sessionId: Number(r.sessionId),
      teamId: Number(r.teamId),
      teamName: r.teamName,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async exportScoresBySession(sessionId: number, format: "csv" | "excel"): Promise<string | Buffer> {
    const sessionInfo = await AppDataSource.getRepository(ContestSession).findOne({ where: { id: sessionId } });
    const teamId = sessionInfo?.teamId || null;

    const qb = AppDataSource.getRepository(Contestant)
      .createQueryBuilder("c")
      .innerJoin("teams", "t", "t.id = c.team_id")
      .leftJoin(
        "answers",
        "a",
        "a.contestant_id = c.id AND a.session_id = :sessionId",
        { sessionId }
      );

    if (teamId) {
      qb.where("c.team_id = :teamId", { teamId });
    }

    const rows = await qb
      .select("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("c.team_id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("COALESCE(SUM(a.score_earned), 0)", "totalScore")
      .groupBy("c.id")
      .addGroupBy("c.name")
      .addGroupBy("c.team_id")
      .addGroupBy("t.name")
      .orderBy("totalScore", "DESC")
      .addOrderBy("c.id", "ASC")
      .getRawMany<{ contestantId: string; contestantName: string; teamName: string; totalScore: string }>();

    if (format === "csv") {
      let csv = "\uFEFF"; // BOM for UTF-8 Excel support
      csv += "STT,Mã Thí Sinh,Tên Thí Sinh,Đội,Điểm\n";
      rows.forEach((r, index) => {
        csv += `${index + 1},${r.contestantId},"${r.contestantName.replace(/"/g, '""')}","${r.teamName.replace(/"/g, '""')}",${r.totalScore}\n`;
      });
      return csv;
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(`Điểm Phiên ${sessionId}`);

      sheet.columns = [
        { header: "STT", key: "stt", width: 5 },
        { header: "Mã Thí Sinh", key: "id", width: 15 },
        { header: "Tên Thí Sinh", key: "name", width: 30 },
        { header: "Đội", key: "team", width: 25 },
        { header: "Điểm", key: "score", width: 10 }
      ];

      // Styling header
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { horizontal: "center" };

      rows.forEach((r, index) => {
        sheet.addRow({
          stt: index + 1,
          id: r.contestantId,
          name: r.contestantName,
          team: r.teamName,
          score: Number(r.totalScore)
        });
      });

      // Buffer
      return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    }
  }

  async deleteSession(sessionId: number): Promise<void> {
    await AppDataSource.getRepository(ContestSession).delete({ id: sessionId });

    const currentState = await AppDataSource.getRepository(ContestState).findOne({ where: { id: 1 } });
    if (currentState && currentState.currentSessionId === sessionId) {
      // Rollback to previous session
      currentState.currentSessionId = Math.max(1, sessionId - 1);
      
      const prevSessionInfo = await AppDataSource.getRepository(ContestSession).findOne({ where: { id: currentState.currentSessionId } });

      if (prevSessionInfo && prevSessionInfo.teamId) {
        currentState.activeTeamId = prevSessionInfo.teamId;
      } else {
        currentState.activeTeamId = null;
      }

      await AppDataSource.getRepository(ContestState).save(currentState);
    }
  }
}
