import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "./env";
import { Team } from "../modules/team/team.entity";
import { Contestant } from "../modules/contestant/contestant.entity";
import { ExamSet } from "../modules/exam/examSet.entity";
import { Question } from "../modules/question/question.entity";
import { Option } from "../modules/question/option.entity";
import { FillBlankAnswer } from "../modules/question/fillBlankAnswer.entity";
import { Answer } from "../modules/submission/answer.entity";
import { ContestState } from "../modules/contest/contestState.entity";
import { AuditLog } from "../modules/audit/auditLog.entity";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: env.dbHost,
  port: env.dbPort,
  username: env.dbUsername,
  password: env.dbPassword,
  database: env.dbName,
  entities: [Team, Contestant, ExamSet, Question, Option, FillBlankAnswer, Answer, ContestState, AuditLog],
  synchronize: true,
  logging: false
});
