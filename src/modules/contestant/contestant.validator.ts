import { z } from "zod";

export const createContestantSchema = {
  body: z.object({
    teamId: z.number().int().positive().nullable(),
    code: z.string().min(1),
    password: z.string().min(6),
    name: z.string().min(1),
    unit: z.string().optional().nullable()
  })
};

export const updateContestantSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    teamId: z.number().int().positive().nullable().optional(),
    code: z.string().min(1).optional(),
    password: z.string().min(6).optional(),
    name: z.string().min(1).optional(),
    unit: z.string().optional().nullable()
  })
};

export const contestantQuerySchema = {
  query: z.object({
    teamId: z.coerce.number().int().positive().optional()
  })
};

export const contestantIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const bulkAssignTeamSchema = {
  body: z.object({
    contestantIds: z.array(z.number().int().positive()).min(1),
    teamId: z.number().int().positive().nullable()
  })
};

export type CreateContestantDto = z.infer<typeof createContestantSchema.body>;
export type UpdateContestantDto = z.infer<typeof updateContestantSchema.body>;
export type ContestantQueryDto = z.infer<typeof contestantQuerySchema.query>;
export type ContestantIdParamDto = z.infer<typeof contestantIdParamSchema.params>;
export type BulkAssignTeamDto = z.infer<typeof bulkAssignTeamSchema.body>;
