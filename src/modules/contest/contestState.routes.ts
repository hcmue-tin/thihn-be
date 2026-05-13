import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/asyncHandler";
import { authenticate, requireAdmin } from "../../shared/middleware/auth";
import { validate } from "../../shared/middleware/validate";
import { contestStateController } from "./contestState.controller";
import { updateRulesSchema } from "./contestState.validator";

export const contestStateRouter = Router();

contestStateRouter.use(authenticate, requireAdmin);
contestStateRouter.get("/rules", asyncHandler(contestStateController.getRules.bind(contestStateController)));
contestStateRouter.put("/rules", validate(updateRulesSchema), asyncHandler(contestStateController.updateRules.bind(contestStateController)));
contestStateRouter.get("/sessions", asyncHandler(contestStateController.getSessions.bind(contestStateController)));
contestStateRouter.delete("/sessions/:sessionId", asyncHandler(contestStateController.deleteSession.bind(contestStateController)));
contestStateRouter.get("/export-scores", asyncHandler(contestStateController.exportScores.bind(contestStateController)));
