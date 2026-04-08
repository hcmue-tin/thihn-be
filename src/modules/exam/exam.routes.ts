import { Router } from "express";
import { examController } from "./exam.controller";
import { asyncHandler } from "../../shared/middleware/asyncHandler";
import { validate } from "../../shared/middleware/validate";
import { authenticate, requireAdmin } from "../../shared/middleware/auth";
import {
  createExamSetSchema,
  createQuestionSchema,
  examSetIdParamSchema,
  updateExamSetSchema,
  updateQuestionSchema
} from "./exam.validator";

export const examRouter = Router();

examRouter.use(authenticate, requireAdmin);

examRouter.get("/exam-sets", asyncHandler(examController.listExamSets.bind(examController)));
examRouter.post("/exam-sets", validate(createExamSetSchema), asyncHandler(examController.createExamSet.bind(examController)));
examRouter.put("/exam-sets/:id", validate(updateExamSetSchema), asyncHandler(examController.updateExamSet.bind(examController)));
examRouter.delete(
  "/exam-sets/:id",
  validate(examSetIdParamSchema),
  asyncHandler(examController.deleteExamSet.bind(examController))
);
examRouter.get(
  "/exam-sets/:id/questions",
  validate(examSetIdParamSchema),
  asyncHandler(examController.listQuestionsByExamSet.bind(examController))
);

examRouter.post("/questions", validate(createQuestionSchema), asyncHandler(examController.createQuestion.bind(examController)));
examRouter.put(
  "/questions/:id",
  validate(updateQuestionSchema),
  asyncHandler(examController.updateQuestion.bind(examController))
);
examRouter.delete(
  "/questions/:id",
  validate(examSetIdParamSchema),
  asyncHandler(examController.deleteQuestion.bind(examController))
);
