import { Router } from "express";
import { teamController } from "./team.controller";
import { asyncHandler } from "../../shared/middleware/asyncHandler";
import { validate } from "../../shared/middleware/validate";
import { createTeamSchema, teamIdParamSchema, updateTeamSchema } from "./team.validator";
import { authenticate, requireAdmin } from "../../shared/middleware/auth";

export const teamRouter = Router();

teamRouter.use(authenticate, requireAdmin);
teamRouter.get("/", asyncHandler(teamController.list.bind(teamController)));
teamRouter.post("/", validate(createTeamSchema), asyncHandler(teamController.create.bind(teamController)));
teamRouter.put("/:id", validate(updateTeamSchema), asyncHandler(teamController.update.bind(teamController)));
teamRouter.delete("/:id", validate(teamIdParamSchema), asyncHandler(teamController.remove.bind(teamController)));
