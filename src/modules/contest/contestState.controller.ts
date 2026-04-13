import { Request, Response } from "express";
import { ContestService } from "./contest.service";
import { UpdateRulesDto } from "./contestState.validator";

const contestService = new ContestService();

export class ContestStateController {
  async getRules(_req: Request, res: Response): Promise<void> {
    const rulesContent = await contestService.getRulesContent();
    res.json({ success: true, data: { rulesContent } });
  }

  async updateRules(req: Request, res: Response): Promise<void> {
    const body = req.validated?.body as UpdateRulesDto;
    const state = await contestService.updateRulesContent(body.rulesContent);
    res.json({ success: true, data: { rulesContent: state.rulesContent } });
  }
}

export const contestStateController = new ContestStateController();
