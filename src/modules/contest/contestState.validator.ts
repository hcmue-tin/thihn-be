import { z } from "zod";

export const updateRulesSchema = {
  body: z.object({
    rulesContent: z.string()
  })
};

export type UpdateRulesDto = z.infer<typeof updateRulesSchema.body>;
