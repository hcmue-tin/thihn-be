import { AppDataSource } from "../../config/database";
import { Answer } from "../submission/answer.entity";
import { Contestant } from "../contestant/contestant.entity";

type TeamScoreItem = {
  teamId: number;
  name: string;
  totalScore: number;
  contestants: Array<{ contestantId: number; name: string; score: number }>;
};

export class LeaderboardService {
  async getTeamScores(examSetId: number): Promise<TeamScoreItem[]> {
    const rows = await AppDataSource.getRepository(Answer)
      .createQueryBuilder("a")
      .innerJoin("contestants", "c", "c.id = a.contestant_id")
      .innerJoin("teams", "t", "t.id = c.team_id")
      .select("t.id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("COALESCE(SUM(a.score_earned), 0)", "score")
      .where("a.exam_set_id = :examSetId", { examSetId })
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

  async getFinalRankings(): Promise<Array<{ rank: number; contestantId: number; name: string; teamId: number; team: string; totalScore: number }>> {
    const rows = await AppDataSource.getRepository(Contestant)
      .createQueryBuilder("c")
      .innerJoin("teams", "t", "t.id = c.team_id")
      .select("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("c.team_id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("c.total_score", "totalScore")
      .orderBy("c.total_score", "DESC")
      .addOrderBy("c.id", "ASC")
      .getRawMany<{ contestantId: string; contestantName: string; teamId: string; teamName: string; totalScore: string }>();

    return rows.map((row, index) => ({
      rank: index + 1,
      contestantId: Number(row.contestantId),
      name: row.contestantName,
      teamId: Number(row.teamId),
      team: row.teamName,
      totalScore: Number(row.totalScore)
    }));
  }
}
