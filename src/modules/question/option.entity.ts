import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Question } from "./question.entity";

@Entity("options")
@Unique(["questionId", "orderNum"])
export class Option {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "question_id", type: "int" })
  questionId!: number;

  @Column({ type: "varchar", length: 20 })
  label!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "is_correct", type: "boolean", default: false })
  isCorrect!: boolean;

  @Column({ name: "order_num", type: "int" })
  orderNum!: number;

  @ManyToOne(() => Question, (question) => question.options, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question!: Question;
}
