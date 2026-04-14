import { z } from "zod";

export const updateRulesSchema = {
  body: z.object({
    rulesContent: z.string(),
    backgroundUrl: z.string().trim().url().nullable().optional()
  })
};

export type UpdateRulesDto = z.infer<typeof updateRulesSchema.body>;
