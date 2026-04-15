import { AppDataSource } from "../../config/database";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError";
import { ExamSet } from "./examSet.entity";
import { Question, QuestionType } from "../question/question.entity";
import { Option } from "../question/option.entity";
import { FillBlankAnswer } from "../question/fillBlankAnswer.entity";

type QuestionInput = {
  examSetId: number;
  type: QuestionType;
  content: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  countdownSeconds: number;
  score: number;
  orderNum: number;
  options: Array<{ label: string; content: string; isCorrect: boolean; orderNum: number }>;
  fillBlankAnswers: Array<{ acceptedAnswer: string }>;
};

export class ExamService {
  private examSetRepo = AppDataSource.getRepository(ExamSet);
  private questionRepo = AppDataSource.getRepository(Question);

  listExamSets(): Promise<ExamSet[]> {
    return this.examSetRepo.find({ order: { orderNum: "ASC" } });
  }

  createExamSet(input: { name: string; description?: string | null; orderNum: number }): Promise<ExamSet> {
    const entity = this.examSetRepo.create({
      name: input.name,
      description: input.description ?? null,
      orderNum: input.orderNum,
      isActive: false
    });
    return this.examSetRepo.save(entity).catch(() => {
      throw new ConflictError("Exam set order number already exists");
    });
  }

  async updateExamSet(id: number, input: Partial<{ name: string; description: string | null; orderNum: number; isActive: boolean }>) {
    const entity = await this.examSetRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundError("Exam set not found");
    Object.assign(entity, input);
    try {
      return await this.examSetRepo.save(entity);
    } catch {
      throw new ConflictError("Exam set order number already exists");
    }
  }

  async deleteExamSet(id: number): Promise<void> {
    const entity = await this.examSetRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundError("Exam set not found");
    await this.examSetRepo.remove(entity);
  }

  async listQuestionsByExamSet(id: number): Promise<Question[]> {
    await this.ensureExamSetExists(id);
    return this.questionRepo.find({
      where: { examSetId: id },
      relations: ["options", "fillBlankAnswers"],
      order: { orderNum: "ASC", options: { orderNum: "ASC" } }
    });
  }

  async createQuestion(input: QuestionInput): Promise<Question> {
    this.validateQuestionInput(input);
    await this.ensureExamSetExists(input.examSetId);

    return AppDataSource.transaction(async (manager) => {
      const question = manager.create(Question, {
        examSetId: input.examSetId,
        type: input.type,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        audioUrl: input.audioUrl ?? null,
        countdownSeconds: input.countdownSeconds,
        score: input.score,
        orderNum: input.orderNum
      });

      let savedQuestion: Question;
      try {
        savedQuestion = await manager.save(Question, question);
      } catch {
        throw new ConflictError("Question order already exists in this exam set");
      }

      if (input.options.length > 0) {
        const options = input.options.map((item) =>
          manager.create(Option, {
            questionId: savedQuestion.id,
            label: item.label,
            content: item.content,
            isCorrect: item.isCorrect,
            orderNum: item.orderNum
          })
        );
        try {
          await manager.save(Option, options);
        } catch {
          throw new ConflictError("Option order already exists in this question");
        }
      }

      if (input.fillBlankAnswers.length > 0) {
        const answers = input.fillBlankAnswers.map((item) =>
          manager.create(FillBlankAnswer, {
            questionId: savedQuestion.id,
            acceptedAnswer: item.acceptedAnswer
          })
        );
        await manager.save(FillBlankAnswer, answers);
      }

      return manager.findOneOrFail(Question, {
        where: { id: savedQuestion.id },
        relations: ["options", "fillBlankAnswers"]
      });
    });
  }

  async updateQuestion(id: number, input: Partial<QuestionInput>): Promise<Question> {
    const existed = await this.questionRepo.findOne({ where: { id }, relations: ["options", "fillBlankAnswers"] });
    if (!existed) throw new NotFoundError("Question not found");

    const merged = this.mergeQuestionInput(existed, input);
    this.validateQuestionInput(merged);

    return AppDataSource.transaction(async (manager) => {
      Object.assign(existed, {
        examSetId: input.examSetId ?? existed.examSetId,
        type: input.type ?? existed.type,
        content: input.content ?? existed.content,
        imageUrl: input.imageUrl ?? existed.imageUrl,
        audioUrl: input.audioUrl ?? existed.audioUrl,
        countdownSeconds: input.countdownSeconds ?? existed.countdownSeconds,
        score: input.score ?? existed.score,
        orderNum: input.orderNum ?? existed.orderNum
      });
      await manager.save(Question, existed);

      if (input.options) {
        await manager.delete(Option, { questionId: id });
        const options = input.options.map((item) =>
          manager.create(Option, {
            questionId: id,
            label: item.label,
            content: item.content,
            isCorrect: item.isCorrect,
            orderNum: item.orderNum
          })
        );
        if (options.length > 0) await manager.save(Option, options);
      }

      if (input.fillBlankAnswers !== undefined) {
        await manager.delete(FillBlankAnswer, { questionId: id });
        const fillItems = input.fillBlankAnswers.map((item) =>
          manager.create(FillBlankAnswer, { questionId: id, acceptedAnswer: item.acceptedAnswer })
        );
        if (fillItems.length > 0) await manager.save(FillBlankAnswer, fillItems);
      }

      return manager.findOneOrFail(Question, { where: { id }, relations: ["options", "fillBlankAnswers"] });
    });
  }

  async deleteQuestion(id: number): Promise<void> {
    const question = await this.questionRepo.findOne({ where: { id } });
    if (!question) throw new NotFoundError("Question not found");
    await this.questionRepo.remove(question);
  }

  private validateQuestionInput(input: QuestionInput): void {
    if (["ordering", "matching"].includes(input.type) && input.fillBlankAnswers.length === 0) {
      throw new ValidationError(`${input.type} question requires at least 1 accepted answer`);
    }
    if (input.type === "fill_blank") {
      const nonempty = input.options.filter((o) => o.content.trim().length > 0);
      if (nonempty.length < 2) {
        throw new ValidationError("fill_blank requires at least 2 answer choices");
      }
      const correct = nonempty.filter((o) => o.isCorrect);
      if (correct.length !== 1) {
        throw new ValidationError("fill_blank requires exactly one correct answer");
      }
    }
    if (["true_false", "single_choice", "multiple_choice", "listening_choice"].includes(input.type) && input.options.length === 0) {
      throw new ValidationError("Choice question requires options");
    }
    if (input.type === "ordering" && input.options.length === 0) {
      throw new ValidationError("ordering question requires option fragments (A, B, C, …)");
    }
    if (input.type === "listening_choice" && !input.audioUrl) {
      throw new ValidationError("listening_choice question requires audioUrl");
    }
  }

  private mergeQuestionInput(existed: Question, input: Partial<QuestionInput>): QuestionInput {
    return {
      examSetId: input.examSetId ?? existed.examSetId,
      type: input.type ?? existed.type,
      content: input.content ?? existed.content,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl : existed.imageUrl,
      audioUrl: input.audioUrl !== undefined ? input.audioUrl : existed.audioUrl,
      countdownSeconds: input.countdownSeconds ?? existed.countdownSeconds,
      score: input.score ?? existed.score,
      orderNum: input.orderNum ?? existed.orderNum,
      options:
        input.options ??
        (existed.options ?? []).map((o) => ({
          label: o.label,
          content: o.content,
          isCorrect: o.isCorrect,
          orderNum: o.orderNum
        })),
      fillBlankAnswers:
        input.fillBlankAnswers ??
        (existed.fillBlankAnswers ?? []).map((f) => ({
          acceptedAnswer: f.acceptedAnswer
        }))
    };
  }

  private async ensureExamSetExists(examSetId: number): Promise<void> {
    const examSet = await this.examSetRepo.findOne({ where: { id: examSetId } });
    if (!examSet) throw new NotFoundError("Exam set not found");
  }
}
