import { z } from "zod";

const urlOrEmpty = z.union([z.string().trim().url(), z.string().trim().startsWith("/"), z.literal("")]);

export const updateRulesSchema = {
  body: z.object({
    rulesContent: z.string(),
    backgroundUrl: urlOrEmpty.nullable().optional(),
    ledBackgroundUrl: urlOrEmpty.nullable().optional(),
    ledWaitingBackgroundUrl: urlOrEmpty.nullable().optional(),
    contestantBackgroundUrl: urlOrEmpty.nullable().optional()
  })
};

export type UpdateRulesDto = z.infer<typeof updateRulesSchema.body>;
