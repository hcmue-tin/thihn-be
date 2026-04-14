import { Request, Response } from "express";
import { ContestService } from "./contest.service";
import { UpdateRulesDto } from "./contestState.validator";

const contestService = new ContestService();

export class ContestStateController {
  async getRules(_req: Request, res: Response): Promise<void> {
    const state = await contestService.getCurrentState();
    res.json({ success: true, data: { rulesContent: state.rulesContent ?? null, backgroundUrl: state.backgroundUrl ?? null } });
  }

  async updateRules(req: Request, res: Response): Promise<void> {
    const body = req.validated?.body as UpdateRulesDto;
    const state = await contestService.updateDisplayConfig({
      rulesContent: body.rulesContent,
      backgroundUrl: body.backgroundUrl ?? null
    });
    res.json({ success: true, data: { rulesContent: state.rulesContent, backgroundUrl: state.backgroundUrl ?? null } });
  }
}

export const contestStateController = new ContestStateController();
