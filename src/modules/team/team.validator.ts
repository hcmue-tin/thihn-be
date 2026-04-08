import { z } from "zod";

export const createTeamSchema = {
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable()
  })
};

export const updateTeamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable()
  })
};

export const teamIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export type CreateTeamDto = z.infer<typeof createTeamSchema.body>;
export type UpdateTeamDto = z.infer<typeof updateTeamSchema.body>;
export type TeamIdParamDto = z.infer<typeof teamIdParamSchema.params>;
