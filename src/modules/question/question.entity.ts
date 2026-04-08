import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { ExamSet } from "../exam/examSet.entity";
import { Option } from "./option.entity";
import { FillBlankAnswer } from "./fillBlankAnswer.entity";
import { Answer } from "../submission/answer.entity";

export type QuestionType = "single_choice" | "multiple_choice" | "fill_blank";

@Entity("questions")
@Unique(["examSetId", "orderNum"])
export class Question {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: "exam_set_id", type: "int" })
  examSetId!: number;

  @Column({
    type: "enum",
    enum: ["single_choice", "multiple_choice", "fill_blank"]
  })
  type!: QuestionType;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "image_url", type: "varchar", length: 255, nullable: true })
  imageUrl!: string | null;

  @Column({ name: "audio_url", type: "varchar", length: 255, nullable: true })
  audioUrl!: string | null;

  @Column({ name: "countdown_seconds", type: "int" })
  countdownSeconds!: number;

  @Column({ type: "float" })
  score!: number;

  @Column({ name: "order_num", type: "int" })
  orderNum!: number;

  @ManyToOne(() => ExamSet, (examSet) => examSet.questions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exam_set_id" })
  examSet!: ExamSet;

  @OneToMany(() => Option, (option) => option.question)
  options!: Option[];

  @OneToMany(() => FillBlankAnswer, (fillBlankAnswer) => fillBlankAnswer.question)
  fillBlankAnswers!: FillBlankAnswer[];

  @OneToMany(() => Answer, (answer) => answer.question)
  answers!: Answer[];
}
