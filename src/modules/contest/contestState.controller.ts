import { Request, Response } from "express";
import { ContestService } from "./contest.service";
import { UpdateRulesDto } from "./contestState.validator";
import { LeaderboardService } from "../leaderboard/leaderboard.service";

const contestService = new ContestService();
const leaderboardService = new LeaderboardService();

export class ContestStateController {
  async getRules(_req: Request, res: Response): Promise<void> {
    const state = await contestService.getCurrentState();
    res.json({
      success: true,
      data: {
        rulesContent: state.rulesContent ?? null,
        backgroundUrl: state.backgroundUrl ?? null,
        ledBackgroundUrl: state.ledBackgroundUrl ?? state.backgroundUrl ?? null,
        ledWaitingBackgroundUrl: state.ledWaitingBackgroundUrl ?? null,
        contestantBackgroundUrl: state.contestantBackgroundUrl ?? state.backgroundUrl ?? null
      }
    });
  }

  async updateRules(req: Request, res: Response): Promise<void> {
    const body = req.validated?.body as UpdateRulesDto;
    const state = await contestService.updateDisplayConfig({
      rulesContent: body.rulesContent,
      backgroundUrl: body.backgroundUrl === "" ? null : body.backgroundUrl,
      ledBackgroundUrl: body.ledBackgroundUrl === "" ? null : body.ledBackgroundUrl,
      ledWaitingBackgroundUrl: body.ledWaitingBackgroundUrl === "" ? null : body.ledWaitingBackgroundUrl,
      contestantBackgroundUrl: body.contestantBackgroundUrl === "" ? null : body.contestantBackgroundUrl
    });
    res.json({
      success: true,
      data: {
        rulesContent: state.rulesContent,
        backgroundUrl: state.backgroundUrl ?? null,
        ledBackgroundUrl: state.ledBackgroundUrl ?? state.backgroundUrl ?? null,
        ledWaitingBackgroundUrl: state.ledWaitingBackgroundUrl ?? null,
        contestantBackgroundUrl: state.contestantBackgroundUrl ?? state.backgroundUrl ?? null
      }
    });
  }

  async getSessions(_req: Request, res: Response): Promise<void> {
    const sessions = await leaderboardService.getAvailableSessions();
    res.json({
      success: true,
      data: sessions
    });
  }

  async exportScores(req: Request, res: Response): Promise<void> {
    const sessionId = Number(req.query.sessionId);
    if (!sessionId || isNaN(sessionId)) {
      res.status(400).json({ success: false, error: "Invalid sessionId" });
      return;
    }
    
    const format = req.query.format === "excel" ? "excel" : "csv";
    const data = await leaderboardService.exportScoresBySession(sessionId, format);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="diem-thi-phien-${sessionId}.csv"`);
      res.send(data);
    } else {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="diem-thi-phien-${sessionId}.xlsx"`);
      res.send(data);
    }
  }

  async deleteSession(req: Request, res: Response): Promise<void> {
    const sessionId = Number(req.params.sessionId);
    if (!sessionId || isNaN(sessionId)) {
      res.status(400).json({ success: false, error: "Invalid sessionId" });
      return;
    }
    
    await leaderboardService.deleteSession(sessionId);
    res.json({ success: true, data: { sessionId } });
  }
}

export const contestStateController = new ContestStateController();
