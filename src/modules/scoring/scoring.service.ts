import { AppDataSource } from "../../config/database";
import { Answer } from "../submission/answer.entity";
import { FillBlankAnswer } from "../question/fillBlankAnswer.entity";
import { Option } from "../question/option.entity";
import { Question } from "../question/question.entity";
import { NotFoundError } from "../../shared/errors/AppError";

type ScoringResult = {
  stats: Record<string, number>;
  contestantResults: Array<{ contestantId: number; questionId: number; isCorrect: boolean; scoreEarned: number; totalScore: number }>;
};

export class ScoringService {
  private questionRepo = AppDataSource.getRepository(Question);
  private optionRepo = AppDataSource.getRepository(Option);
  private fillBlankRepo = AppDataSource.getRepository(FillBlankAnswer);
  private answerRepo = AppDataSource.getRepository(Answer);

  async recomputeOfficialTotals(contestantIds: number[]): Promise<Map<number, number>> {
    const uniqueContestantIds = [...new Set(contestantIds)].filter(Number.isFinite);
    if (uniqueContestantIds.length === 0) {
      return new Map();
    }

    const totals = await AppDataSource.getRepository(Answer)
      .createQueryBuilder("a")
      .select("a.contestant_id", "contestantId")
      .addSelect("COALESCE(SUM(a.score_earned), 0)", "totalScore")
      .where("a.contestant_id IN (:...contestantIds)", { contestantIds: uniqueContestantIds })
      .groupBy("a.contestant_id")
      .getRawMany<{ contestantId: string; totalScore: string }>();

    const totalMap = new Map<number, number>(totals.map((row) => [Number(row.contestantId), Number(row.totalScore)]));
    const totalCase = uniqueContestantIds.map((id) => `WHEN ${id} THEN ${totalMap.get(id) ?? 0}`).join(" ");
    await AppDataSource.query(
      `UPDATE contestants
       SET total_score = CASE id ${totalCase} ELSE total_score END
       WHERE id IN (${uniqueContestantIds.join(",")})`
    );

    return new Map(uniqueContestantIds.map((id) => [id, totalMap.get(id) ?? 0]));
  }

  normalizeFillBlank(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,!?;:，。！？、；：]/g, "")
      .replace(/\s+/g, " ");
  }

  private canonicalizeMatchingAnswer(value: string): string {
    const pairs = value
      .replace(/\n/g, ";")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.replace(/\./g, ":"))
      .map((item) => {
        const [left, right] = item.split(":").map((s) => s.trim());
        return { left: Number(left), right: (right ?? "").toUpperCase() };
      })
      .filter((item) => Number.isInteger(item.left) && item.left > 0 && /^[A-Z]$/.test(item.right))
      .sort((a, b) => a.left - b.left);

    if (pairs.length === 0) return "";
    return pairs.map((item) => `${item.left}:${item.right}`).join(";");
  }

  private normalizeMatchingAcceptedAnswers(fillBlankAnswers: FillBlankAnswer[]): string[] {
    const raw = fillBlankAnswers.map((item) => item.acceptedAnswer.trim()).filter(Boolean);
    if (raw.length === 0) return [];

    const isPairToken = (value: string) => /^\d+\s*[:.]\s*[A-Za-z]$/.test(value.trim());
    const legacyMerged = raw.every(isPairToken) ? [raw.join(";")] : [];

    const normalized = [...legacyMerged, ...raw]
      .map((item) => this.canonicalizeMatchingAnswer(item))
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  async scoreAll(questionId: number, sessionId: number): Promise<ScoringResult> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");

    const [answers, options, fillBlankAnswers] = await Promise.all([
      this.answerRepo.find({ where: { questionId, sessionId } }),
      this.optionRepo.find({ where: { questionId } }),
      this.fillBlankRepo.find({ where: { questionId } })
    ]);

    if (answers.length === 0) {
      return { stats: { total: 0, correct: 0, correctRate: 0 }, contestantResults: [] };
    }

    const correctOptionIds = options.filter((o) => o.isCorrect).map((o) => o.id).sort((a, b) => a - b);
    const normalizedAccepted = fillBlankAnswers.map((item) => this.normalizeFillBlank(item.acceptedAnswer));
    const normalizedMatchingAccepted = this.normalizeMatchingAcceptedAnswers(fillBlankAnswers);

    const evaluated = answers.map((answer) => {
      let isCorrect = false;
      switch (question.type) {
        case "true_false":
        case "single_choice": {
          const selected = (answer.selectedOptionIds ?? [])[0];
          isCorrect = selected !== undefined && correctOptionIds.length > 0 && selected === correctOptionIds[0];
          break;
        }
        case "listening_choice": {
          const selected = (answer.selectedOptionIds ?? [])[0];
          isCorrect = selected !== undefined && correctOptionIds.length > 0 && selected === correctOptionIds[0];
          break;
        }
        case "multiple_choice": {
          const selected = [...(answer.selectedOptionIds ?? [])].sort((a, b) => a - b);
          isCorrect = JSON.stringify(selected) === JSON.stringify(correctOptionIds);
          break;
        }
        case "fill_blank": {
          const selectedFb = (answer.selectedOptionIds ?? [])[0];
          if (selectedFb !== undefined && correctOptionIds.length > 0) {
            isCorrect = selectedFb === correctOptionIds[0];
          } else {
            const normalizedUser = this.normalizeFillBlank(answer.fillText ?? "");
            isCorrect = normalizedAccepted.length > 0 && normalizedAccepted.includes(normalizedUser);
          }
          break;
        }
        case "ordering": {
          const normalizedUser = this.normalizeFillBlank(answer.fillText ?? "");
          isCorrect = normalizedAccepted.includes(normalizedUser);
          break;
        }
        case "matching": {
          const normalizedUser = this.canonicalizeMatchingAnswer(answer.fillText ?? "");
          isCorrect = normalizedUser.length > 0 && normalizedMatchingAccepted.includes(normalizedUser);
          break;
        }
      }
      return {
        answerId: answer.id,
        contestantId: answer.contestantId,
        questionId: answer.questionId,
        isCorrect,
        scoreEarned: isCorrect ? question.score : 0
      };
    });

    await AppDataSource.transaction(async (manager) => {
      const answerIds = evaluated.map((item) => item.answerId);
      const isCorrectCase = evaluated.map((item) => `WHEN ${item.answerId} THEN ${item.isCorrect ? 1 : 0}`).join(" ");
      const scoreCase = evaluated.map((item) => `WHEN ${item.answerId} THEN ${item.scoreEarned}`).join(" ");

      await manager.query(
        `UPDATE answers
         SET is_correct = CASE id ${isCorrectCase} END,
             score_earned = CASE id ${scoreCase} END
         WHERE id IN (${answerIds.join(",")})`
      );

    });

    const totalMap = await this.recomputeOfficialTotals(evaluated.map((item) => item.contestantId));
    const correctCount = evaluated.filter((item) => item.isCorrect).length;

    return {
      stats: {
        total: evaluated.length,
        correct: correctCount,
        correctRate: evaluated.length > 0 ? Number(((correctCount / evaluated.length) * 100).toFixed(2)) : 0
      },
      contestantResults: evaluated.map((item) => ({
        contestantId: item.contestantId,
        questionId: item.questionId,
        isCorrect: item.isCorrect,
        scoreEarned: item.scoreEarned,
        totalScore: totalMap.get(item.contestantId) ?? 0
      }))
    };
  }
}
