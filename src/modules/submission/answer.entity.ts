import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Contestant } from "../contestant/contestant.entity";
import { Question } from "../question/question.entity";
import { ExamSet } from "../exam/examSet.entity";

@Entity("answers")
@Unique(["contestantId", "questionId"])
export class Answer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: "contestant_id", type: "int" })
  contestantId!: number;

  @Index()
  @Column({ name: "question_id", type: "int" })
  questionId!: number;

  @Column({ name: "selected_option_ids", type: "json", nullable: true })
  selectedOptionIds!: number[] | null;

  @Column({ name: "fill_text", type: "varchar", length: 255, nullable: true })
  fillText!: string | null;

  @Column({ name: "is_correct", type: "boolean", nullable: true })
  isCorrect!: boolean | null;

  @Column({ name: "score_earned", type: "float", nullable: true })
  scoreEarned!: number | null;

  @Column({ name: "submitted_at", type: "datetime" })
  submittedAt!: Date;

  @Index()
  @Column({ name: "exam_set_id", type: "int" })
  examSetId!: number;

  @ManyToOne(() => Contestant, (contestant) => contestant.answers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "contestant_id" })
  contestant!: Contestant;

  @ManyToOne(() => Question, (question) => question.answers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question!: Question;

  @ManyToOne(() => ExamSet, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exam_set_id" })
  examSet!: ExamSet;
}
