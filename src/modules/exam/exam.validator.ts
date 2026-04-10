import { z } from "zod";

const optionSchema = z.object({
  label: z.string().min(1),
  content: z.string().min(1),
  isCorrect: z.boolean(),
  orderNum: z.number().int().positive()
});

const fillBlankAnswerSchema = z.object({
  acceptedAnswer: z.string().min(1)
});

export const examSetIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  })
};

export const createExamSetSchema = {
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    orderNum: z.number().int().positive()
  })
};

export const updateExamSetSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    orderNum: z.number().int().positive().optional(),
    isActive: z.boolean().optional()
  })
};

export const createQuestionSchema = {
  body: z.object({
    examSetId: z.number().int().positive(),
    type: z.enum(["true_false", "single_choice", "multiple_choice", "fill_blank", "ordering", "matching", "listening_choice"]),
    content: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
    audioUrl: z.string().optional().nullable(),
    countdownSeconds: z.number().int().positive(),
    score: z.number().positive(),
    orderNum: z.number().int().positive(),
    options: z.array(optionSchema).default([]),
    fillBlankAnswers: z.array(fillBlankAnswerSchema).default([])
  })
};

export const updateQuestionSchema = {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: createQuestionSchema.body.partial()
};

export type ExamSetIdParamDto = z.infer<typeof examSetIdParamSchema.params>;
export type CreateExamSetDto = z.infer<typeof createExamSetSchema.body>;
export type UpdateExamSetDto = z.infer<typeof updateExamSetSchema.body>;
export type CreateQuestionDto = z.infer<typeof createQuestionSchema.body>;
export type UpdateQuestionDto = z.infer<typeof updateQuestionSchema.body>;
