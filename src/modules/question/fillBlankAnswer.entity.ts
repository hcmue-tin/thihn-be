import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Question } from "./question.entity";

@Entity("fill_blank_answers")
export class FillBlankAnswer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "question_id", type: "int" })
  questionId!: number;

  @Column({ name: "accepted_answer", type: "varchar", length: 255 })
  acceptedAnswer!: string;

  @ManyToOne(() => Question, (question) => question.fillBlankAnswers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question!: Question;
}
