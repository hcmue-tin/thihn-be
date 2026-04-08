import { z } from "zod";

export const adminLoginSchema = {
  body: z.object({
    password: z.string().min(1)
  })
};

export const contestantLoginSchema = {
  body: z.object({
    code: z.string().min(1),
    password: z.string().min(1)
  })
};

export type AdminLoginDto = z.infer<typeof adminLoginSchema.body>;
export type ContestantLoginDto = z.infer<typeof contestantLoginSchema.body>;
