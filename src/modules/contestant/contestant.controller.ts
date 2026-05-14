import { Request, Response } from "express";
import { ContestantService } from "./contestant.service";
import { ValidationError } from "../../shared/errors/AppError";
import {
  BulkAssignTeamDto,
  ContestantIdParamDto,
  ContestantQueryDto,
  CreateContestantDto,
  UpdateContestantDto
} from "./contestant.validator";

const contestantService = new ContestantService();

export class ContestantController {
  async list(req: Request, res: Response): Promise<void> {
    const query: ContestantQueryDto = req.validated?.query as ContestantQueryDto;
    const data = await contestantService.list(query.teamId);
    res.json({ success: true, data });
  }

  async meScore(req: Request, res: Response): Promise<void> {
    const contestantId = req.user?.contestantId;
    if (!contestantId) {
      throw new ValidationError("Missing contestant identity");
    }
    const data = await contestantService.getOfficialScoreByContestant(contestantId);
    res.json({ success: true, data });
  }

  async create(req: Request, res: Response): Promise<void> {
    const input: CreateContestantDto = req.validated?.body as CreateContestantDto;
    const data = await contestantService.create(input);
    res.status(201).json({ success: true, data });
  }

  async update(req: Request, res: Response): Promise<void> {
    const params: ContestantIdParamDto = req.validated?.params as ContestantIdParamDto;
    const input: UpdateContestantDto = req.validated?.body as UpdateContestantDto;
    const data = await contestantService.update(params.id, input);
    res.json({ success: true, data });
  }

  async remove(req: Request, res: Response): Promise<void> {
    const params: ContestantIdParamDto = req.validated?.params as ContestantIdParamDto;
    await contestantService.remove(params.id);
    res.json({ success: true, data: null });
  }

  async history(req: Request, res: Response): Promise<void> {
    const params: ContestantIdParamDto = req.validated?.params as ContestantIdParamDto;
    const data = await contestantService.getHistoryByContestant(params.id);
    res.json({ success: true, data });
  }

  async bulkTeam(req: Request, res: Response): Promise<void> {
    const body = req.validated?.body as BulkAssignTeamDto;
    await contestantService.bulkAssignTeam(body.contestantIds, body.teamId);
    res.json({ success: true, data: null });
  }

  async importExcel(req: Request, res: Response): Promise<void> {
    const file = req.file as Express.Multer.File | undefined;
    if (!file?.buffer) {
      throw new ValidationError("Thiếu file Excel (.xlsx)");
    }
    const data = await contestantService.importFromExcelBuffer(file.buffer);
    res.json({ success: true, data });
  }

  async export(req: Request, res: Response): Promise<void> {
    const format = req.query.format === "excel" ? "excel" : "csv";
    const data = await contestantService.exportAll(format);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="diem-thi-sinh.csv"`);
      res.send(data);
    } else {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="diem-thi-sinh.xlsx"`);
      res.send(data);
    }
  }
}

export const contestantController = new ContestantController();
