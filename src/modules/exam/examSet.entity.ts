import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Question } from "../question/question.entity";

@Entity("exam_sets")
@Unique(["orderNum"])
export class ExamSet {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;

  @Column({ name: "order_num", type: "int" })
  orderNum!: number;

  @Column({ name: "is_active", type: "boolean", default: false })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @OneToMany(() => Question, (question) => question.examSet)
  questions!: Question[];
}
