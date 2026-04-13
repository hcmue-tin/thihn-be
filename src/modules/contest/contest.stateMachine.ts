import { StateError } from "../../shared/errors/AppError";
import { ContestState } from "./contestState.entity";

export type ContestScreen = ContestState["screen"];

const validTransitions: Record<ContestScreen, ContestScreen[]> = {
  idle: ["waiting"],
  waiting: ["rules", "team_list", "question"],
  rules: ["waiting", "team_list", "question"],
  team_list: ["waiting", "rules", "question"],
  question: ["countdown"],
  countdown: ["reveal"],
  reveal: ["question", "team_score", "waiting"],
  team_score: ["question", "leaderboard", "waiting"],
  leaderboard: ["waiting"]
};

export const canTransition = (from: ContestScreen, to: ContestScreen): boolean => validTransitions[from].includes(to);

export const assertTransition = (from: ContestScreen, to: ContestScreen): void => {
  if (from === to) {
    return;
  }
  if (!canTransition(from, to)) {
    throw new StateError(`Invalid transition from '${from}' to '${to}'`);
  }
};
