import { Request, Response } from "express";
import { TeamService } from "./team.service";
import { CreateTeamDto, TeamIdParamDto, UpdateTeamDto } from "./team.validator";

const teamService = new TeamService();

export class TeamController {
  async list(_req: Request, res: Response): Promise<void> {
    const data = await teamService.list();
    res.json({ success: true, data });
  }

  async create(req: Request, res: Response): Promise<void> {
    const input: CreateTeamDto = req.validated?.body as CreateTeamDto;
    const data = await teamService.create(input);
    res.status(201).json({ success: true, data });
  }

  async update(req: Request, res: Response): Promise<void> {
    const params: TeamIdParamDto = req.validated?.params as TeamIdParamDto;
    const input: UpdateTeamDto = req.validated?.body as UpdateTeamDto;
    const data = await teamService.update(params.id, input);
    res.json({ success: true, data });
  }

  async remove(req: Request, res: Response): Promise<void> {
    const params: TeamIdParamDto = req.validated?.params as TeamIdParamDto;
    await teamService.remove(params.id);
    res.json({ success: true, data: null });
  }
}

export const teamController = new TeamController();
