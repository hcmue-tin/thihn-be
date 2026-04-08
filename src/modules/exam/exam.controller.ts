import { Request, Response } from "express";
import { ExamService } from "./exam.service";
import {
  CreateExamSetDto,
  CreateQuestionDto,
  ExamSetIdParamDto,
  UpdateExamSetDto,
  UpdateQuestionDto
} from "./exam.validator";

const examService = new ExamService();

export class ExamController {
  async listExamSets(_req: Request, res: Response): Promise<void> {
    const data = await examService.listExamSets();
    res.json({ success: true, data });
  }

  async createExamSet(req: Request, res: Response): Promise<void> {
    const input: CreateExamSetDto = req.validated?.body as CreateExamSetDto;
    const data = await examService.createExamSet(input);
    res.status(201).json({ success: true, data });
  }

  async updateExamSet(req: Request, res: Response): Promise<void> {
    const params: ExamSetIdParamDto = req.validated?.params as ExamSetIdParamDto;
    const input: UpdateExamSetDto = req.validated?.body as UpdateExamSetDto;
    const data = await examService.updateExamSet(params.id, input);
    res.json({ success: true, data });
  }

  async deleteExamSet(req: Request, res: Response): Promise<void> {
    const params: ExamSetIdParamDto = req.validated?.params as ExamSetIdParamDto;
    await examService.deleteExamSet(params.id);
    res.json({ success: true, data: null });
  }

  async listQuestionsByExamSet(req: Request, res: Response): Promise<void> {
    const params: ExamSetIdParamDto = req.validated?.params as ExamSetIdParamDto;
    const data = await examService.listQuestionsByExamSet(params.id);
    res.json({ success: true, data });
  }

  async createQuestion(req: Request, res: Response): Promise<void> {
    const input: CreateQuestionDto = req.validated?.body as CreateQuestionDto;
    const data = await examService.createQuestion(input);
    res.status(201).json({ success: true, data });
  }

  async updateQuestion(req: Request, res: Response): Promise<void> {
    const params: ExamSetIdParamDto = req.validated?.params as ExamSetIdParamDto;
    const input: UpdateQuestionDto = req.validated?.body as UpdateQuestionDto;
    const data = await examService.updateQuestion(params.id, input);
    res.json({ success: true, data });
  }

  async deleteQuestion(req: Request, res: Response): Promise<void> {
    const params: ExamSetIdParamDto = req.validated?.params as ExamSetIdParamDto;
    await examService.deleteQuestion(params.id);
    res.json({ success: true, data: null });
  }
}

export const examController = new ExamController();
