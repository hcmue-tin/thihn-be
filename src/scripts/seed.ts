import bcrypt from "bcrypt";
import { AppDataSource } from "../config/database";
import { Team } from "../modules/team/team.entity";
import { ExamSet } from "../modules/exam/examSet.entity";
import { ContestState } from "../modules/contest/contestState.entity";
import { env } from "../config/env";
import { logger } from "../shared/utils/logger";

const seed = async (): Promise<void> => {
  await AppDataSource.initialize();

  const teamRepo = AppDataSource.getRepository(Team);
  const examSetRepo = AppDataSource.getRepository(ExamSet);
  const contestStateRepo = AppDataSource.getRepository(ContestState);

  const teamCount = await teamRepo.count();
  if (teamCount === 0) {
    await teamRepo.save(teamRepo.create({ name: "Team 1", description: "Default seeded team" }));
  }

  const examSetCount = await examSetRepo.count();
  if (examSetCount === 0) {
    await examSetRepo.save(examSetRepo.create({ name: "Bo de 1", description: "Default seeded exam set", orderNum: 1 }));
  }

  const state = await contestStateRepo.findOne({ where: { id: 1 } });
  if (!state) {
    await contestStateRepo.save(
      contestStateRepo.create({
        id: 1,
        screen: "idle",
        currentExamSetId: null,
        currentQuestionId: null,
        isCountdownActive: false,
        countdownEndAt: null,
        version: 0
      })
    );
  }

  const adminHash = await bcrypt.hash(env.adminPassword, 10);
  logger.info(`Seed complete. Admin login password source set. Hash preview: ${adminHash.slice(0, 10)}...`);

  await AppDataSource.destroy();
};

seed().catch(async (error) => {
  logger.error({ error }, "Seed failed");
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
