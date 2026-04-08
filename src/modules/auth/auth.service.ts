import jwt, { Secret, SignOptions } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { env } from "../../config/env";
import { AppDataSource } from "../../config/database";
import { Contestant } from "../contestant/contestant.entity";
import { UnauthorizedError } from "../../shared/errors/AppError";

export class AuthService {
  async loginAdmin(password: string): Promise<{ token: string }> {
    if (password !== env.adminPassword) {
      throw new UnauthorizedError("Invalid admin password");
    }

    const token = jwt.sign({ role: "admin", actor: "system_admin" }, env.jwtSecret as Secret, {
      expiresIn: env.jwtAdminExpiresIn as SignOptions["expiresIn"]
    });
    return { token };
  }

  async loginContestant(code: string, password: string): Promise<{ token: string; contestant: Partial<Contestant> }> {
    const contestantRepo = AppDataSource.getRepository(Contestant);
    const contestant = await contestantRepo.findOne({ where: { code } });
    if (!contestant) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const matched = await bcrypt.compare(password, contestant.password);
    if (!matched) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const token = jwt.sign({ role: "contestant", contestantId: contestant.id }, env.jwtSecret as Secret, {
      expiresIn: env.jwtContestantExpiresIn as SignOptions["expiresIn"]
    });

    return {
      token,
      contestant: {
        id: contestant.id,
        teamId: contestant.teamId,
        code: contestant.code,
        name: contestant.name,
        unit: contestant.unit,
        totalScore: contestant.totalScore
      }
    };
  }
}
