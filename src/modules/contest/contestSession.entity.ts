import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Team } from "../team/team.entity";

@Entity("contest_sessions")
export class ContestSession {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({ name: "team_id", type: "int", nullable: true })
  teamId!: number | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "team_id" })
  team!: Team | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
