import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Team } from "../team/team.entity";
import { Answer } from "../submission/answer.entity";

@Entity("contestants")
@Unique(["code"])
export class Contestant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "team_id", type: "int", nullable: true })
  teamId!: number | null;

  @Column({ type: "varchar", length: 100 })
  code!: string;

  @Column({ type: "varchar", length: 255 })
  password!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  unit!: string | null;

  @Column({ name: "total_score", type: "float", default: 0 })
  totalScore!: number;

  @Column({ name: "is_online", type: "boolean", default: false })
  isOnline!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => Team, (team) => team.contestants, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "team_id" })
  team!: Team | null;

  @OneToMany(() => Answer, (answer) => answer.contestant)
  answers!: Answer[];
}
