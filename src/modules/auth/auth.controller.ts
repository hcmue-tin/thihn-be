import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AdminLoginDto, ContestantLoginDto } from "./auth.validator";

const authService = new AuthService();

export class AuthController {
  async loginAdmin(req: Request, res: Response): Promise<void> {
    const input: AdminLoginDto = req.validated?.body as AdminLoginDto;
    const data = await authService.loginAdmin(input.password);
    res.json({ success: true, data });
  }

  async loginContestant(req: Request, res: Response): Promise<void> {
    const input: ContestantLoginDto = req.validated?.body as ContestantLoginDto;
    const data = await authService.loginContestant(input.code, input.password);
    res.json({ success: true, data });
  }
}

export const authController = new AuthController();
