import bcrypt from "bcrypt";
import { AppDataSource } from "../../config/database";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError";
import { Contestant } from "./contestant.entity";
import { Team } from "../team/team.entity";

export class ContestantService {
  private contestantRepo = AppDataSource.getRepository(Contestant);
  private teamRepo = AppDataSource.getRepository(Team);

  async list(teamId?: number): Promise<Contestant[]> {
    if (teamId) {
      return this.contestantRepo.find({ where: { teamId } });
    }
    return this.contestantRepo.find();
  }

  async create(input: {
    teamId: number;
    code: string;
    password: string;
    name: string;
    unit?: string | null;
  }): Promise<Contestant> {
    await this.ensureTeamExists(input.teamId);
    const existed = await this.contestantRepo.findOne({ where: { code: input.code } });
    if (existed) {
      throw new ConflictError("Contestant code already exists");
    }
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const contestant = this.contestantRepo.create({
      teamId: input.teamId,
      code: input.code,
      password: hashedPassword,
      name: input.name,
      unit: input.unit ?? null,
      totalScore: 0,
      isOnline: false
    });
    return this.contestantRepo.save(contestant);
  }

  async update(
    id: number,
    input: { teamId?: number; code?: string; password?: string; name?: string; unit?: string | null }
  ): Promise<Contestant> {
    const contestant = await this.contestantRepo.findOne({ where: { id } });
    if (!contestant) {
      throw new NotFoundError("Contestant not found");
    }

    if (input.teamId) {
      await this.ensureTeamExists(input.teamId);
      contestant.teamId = input.teamId;
    }

    if (input.code && input.code !== contestant.code) {
      const existed = await this.contestantRepo.findOne({ where: { code: input.code } });
      if (existed) {
        throw new ConflictError("Contestant code already exists");
      }
      contestant.code = input.code;
    }

    if (input.password) {
      contestant.password = await bcrypt.hash(input.password, 10);
    }
    if (input.name !== undefined) {
      contestant.name = input.name;
    }
    if (input.unit !== undefined) {
      contestant.unit = input.unit;
    }

    return this.contestantRepo.save(contestant);
  }

  async remove(id: number): Promise<void> {
    const contestant = await this.contestantRepo.findOne({ where: { id } });
    if (!contestant) {
      throw new NotFoundError("Contestant not found");
    }
    await this.contestantRepo.remove(contestant);
  }

  private async ensureTeamExists(teamId: number): Promise<void> {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundError("Team not found");
    }
  }
}
