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

  async getFinalRankings(teamIds?: number[]): Promise<Array<{ rank: number; contestantId: number; name: string; teamId: number; team: string; totalScore: number }>> {
    let qb = AppDataSource.getRepository(Contestant)
      .createQueryBuilder("c")
      .innerJoin("teams", "t", "t.id = c.team_id")
      .select("c.id", "contestantId")
      .addSelect("c.name", "contestantName")
      .addSelect("c.team_id", "teamId")
      .addSelect("t.name", "teamName")
      .addSelect("c.total_score", "totalScore");

    if (teamIds && teamIds.length > 0) {
      qb = qb.where("t.id IN (:...teamIds)", { teamIds });
    }

    const rows = await qb
      .orderBy("c.total_score", "DESC")
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
}
