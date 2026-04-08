import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/middleware/asyncHandler";
import { adminLoginSchema, contestantLoginSchema } from "./auth.validator";

export const authRouter = Router();

authRouter.post("/admin/login", validate(adminLoginSchema), asyncHandler(authController.loginAdmin.bind(authController)));
authRouter.post(
  "/contestant/login",
  validate(contestantLoginSchema),
  asyncHandler(authController.loginContestant.bind(authController))
);
