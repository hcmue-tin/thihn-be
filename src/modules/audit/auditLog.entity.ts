import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100 })
  actor!: string;

  @Column({ type: "varchar", length: 255 })
  action!: string;

  @Column({ type: "json", nullable: true })
  payload!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
