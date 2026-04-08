import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { ExamSet } from "../exam/examSet.entity";
import { Question } from "../question/question.entity";

@Entity("contest_state")
export class ContestState {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({
    type: "enum",
    enum: ["idle", "waiting", "rules", "team_list", "question", "countdown", "reveal", "team_score", "leaderboard"],
    default: "idle"
  })
  screen!: "idle" | "waiting" | "rules" | "team_list" | "question" | "countdown" | "reveal" | "team_score" | "leaderboard";

  @Column({ name: "current_exam_set_id", type: "int", nullable: true })
  currentExamSetId!: number | null;

  @Column({ name: "current_question_id", type: "int", nullable: true })
  currentQuestionId!: number | null;

  @Column({ name: "is_countdown_active", type: "boolean", default: false })
  isCountdownActive!: boolean;

  @Column({ name: "countdown_end_at", type: "datetime", nullable: true })
  countdownEndAt!: Date | null;

  @Column({ type: "int", default: 0 })
  version!: number;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @ManyToOne(() => ExamSet, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "current_exam_set_id" })
  currentExamSet!: ExamSet | null;

  @ManyToOne(() => Question, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "current_question_id" })
  currentQuestion!: Question | null;
}
