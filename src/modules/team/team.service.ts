import { AppDataSource } from "../../config/database";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError";
import { Team } from "./team.entity";
import { Contestant } from "../contestant/contestant.entity";

export class TeamService {
  private teamRepo = AppDataSource.getRepository(Team);
  private contestantRepo = AppDataSource.getRepository(Contestant);

  async list(): Promise<Array<{ id: number; name: string; description: string | null; contestantCount: number }>> {
    const teams = await this.teamRepo.find({ relations: ["contestants"] });
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      contestantCount: team.contestants?.length || 0
    }));
  }

  async create(input: { name: string; description?: string | null }): Promise<Team> {
    const team = this.teamRepo.create({ name: input.name, description: input.description ?? null });
    return this.teamRepo.save(team);
  }

  async update(id: number, input: { name?: string; description?: string | null }): Promise<Team> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundError("Team not found");
    }
    Object.assign(team, input);
    return this.teamRepo.save(team);
  }

  async remove(id: number): Promise<void> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundError("Team not found");
    }
    const contestantCount = await this.contestantRepo.count({ where: { teamId: id } });
    if (contestantCount > 0) {
      throw new ConflictError("Cannot delete team with contestants");
    }
    await this.teamRepo.remove(team);
  }
}
