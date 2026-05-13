import { z } from "zod";

export const contestScreenSchema = z.enum([
  "idle",
  "waiting",
  "rules",
  "team_list",
  "question",
  "countdown",
  "reveal",
  "team_score",
  "leaderboard"
]);

export const setScreenSchema = z.object({
  screen: z.enum(["waiting", "rules", "team_list"]),
  teamIds: z.array(z.number().int().positive()).max(1).optional()
});

export const examSetSchema = z.object({ examSetId: z.number().int().positive() });
export const examCodeSchema = z.object({ examSetId: z.number().int().positive() });
const optionalActiveTeamIdSchema = z.number().int().positive().nullable().optional();
export const setActiveTeamSchema = z.object({
  activeTeamId: z.number().int().positive().nullable()
});
export const questionSchema = z.object({
  questionId: z.number().int().positive(),
  activeTeamId: optionalActiveTeamIdSchema
});
export const teamScoreSchema = z.object({
  examSetId: z.number().int().positive(),
  teamIds: z.array(z.number().int().positive()).optional(),
  activeTeamId: optionalActiveTeamIdSchema
});
export const leaderboardSchema = z.object({
  teamIds: z.array(z.number().int().positive()).optional(),
  activeTeamId: optionalActiveTeamIdSchema,
  showAll: z.boolean().optional()
});

export type AckResponse = { success: boolean; message?: string };
export type AckFn = (response: AckResponse) => void;
