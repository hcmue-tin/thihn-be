import { z } from "zod";

export const submitAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  selectedOptionIds: z.array(z.number().int().positive()).optional(),
  fillText: z.string().optional()
});

export type SubmitAnswerDto = z.infer<typeof submitAnswerSchema>;
