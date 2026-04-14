import { Router } from "express";
import { contestantController } from "./contestant.controller";
import { asyncHandler } from "../../shared/middleware/asyncHandler";
import { validate } from "../../shared/middleware/validate";
import {
  contestantIdParamSchema,
  contestantQuerySchema,
  createContestantSchema,
  updateContestantSchema
} from "./contestant.validator";
import { authenticate, requireAdmin } from "../../shared/middleware/auth";

export const contestantRouter = Router();

contestantRouter.use(authenticate, requireAdmin);
contestantRouter.get("/", validate(contestantQuerySchema), asyncHandler(contestantController.list.bind(contestantController)));
contestantRouter.post("/", validate(createContestantSchema), asyncHandler(contestantController.create.bind(contestantController)));
contestantRouter.put(
  "/:id",
  validate(updateContestantSchema),
  asyncHandler(contestantController.update.bind(contestantController))
);
contestantRouter.get(
  "/:id/history",
  validate(contestantIdParamSchema),
  asyncHandler(contestantController.history.bind(contestantController))
);
contestantRouter.delete(
  "/:id",
  validate(contestantIdParamSchema),
  asyncHandler(contestantController.remove.bind(contestantController))
);
