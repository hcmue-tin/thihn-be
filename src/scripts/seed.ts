import bcrypt from "bcrypt";
import { AppDataSource } from "../config/database";
import { Team } from "../modules/team/team.entity";
import { ExamSet } from "../modules/exam/examSet.entity";
import { ContestState } from "../modules/contest/contestState.entity";
import { Question, QuestionType } from "../modules/question/question.entity";
import { Option } from "../modules/question/option.entity";
import { FillBlankAnswer } from "../modules/question/fillBlankAnswer.entity";
import { env } from "../config/env";
import { logger } from "../shared/utils/logger";

type SeedOption = { label: string; content: string; isCorrect: boolean; orderNum: number };
type SeedQuestion = {
  type: QuestionType;
  content: string;
  audioUrl?: string | null;
  imageUrl?: string | null;
  orderNum: number;
  options?: SeedOption[];
  fillAnswers?: string[];
};

const buildVietnameseSeedQuestions = (): SeedQuestion[] => [
  {
    type: "single_choice",
    orderNum: 1,
    content: "Quan sát hình minh họa và chọn câu mô tả đúng.",
    imageUrl: "https://example.com/fake-image-question-1.jpg",
    options: [
      { label: "A", content: "Bức hình mô tả một lớp học", isCorrect: false, orderNum: 1 },
      { label: "B", content: "Bức hình mô tả một thư viện", isCorrect: true, orderNum: 2 },
      { label: "C", content: "Bức hình mô tả một nhà ga", isCorrect: false, orderNum: 3 },
      { label: "D", content: "Bức hình mô tả một siêu thị", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "listening_choice",
    orderNum: 2,
    content: "Nghe audio và chọn ý đúng nhất.",
    audioUrl: "https://example.com/fake-audio-question-2.mp3",
    options: [
      { label: "A", content: "Người nói hẹn gặp lúc 6 giờ", isCorrect: false, orderNum: 1 },
      { label: "B", content: "Người nói xin nghỉ buổi học", isCorrect: false, orderNum: 2 },
      { label: "C", content: "Người nói nhắc nộp bài trước 5 giờ chiều", isCorrect: true, orderNum: 3 },
      { label: "D", content: "Người nói đổi lịch thi sang tuần sau", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "true_false",
    orderNum: 3,
    content: "Việt Nam có 63 tỉnh/thành phố.",
    options: [
      { label: "A", content: "Đúng", isCorrect: true, orderNum: 1 },
      { label: "B", content: "Sai", isCorrect: false, orderNum: 2 }
    ]
  },
  {
    type: "fill_blank",
    orderNum: 4,
    content: "Điền từ còn thiếu: “Có công mài sắt, có ngày nên ____”.",
    options: [
      { label: "A", content: "kim", isCorrect: true, orderNum: 1 },
      { label: "B", content: "dao", isCorrect: false, orderNum: 2 },
      { label: "C", content: "kiếm", isCorrect: false, orderNum: 3 },
      { label: "D", content: "gươm", isCorrect: false, orderNum: 4 }
    ],
    fillAnswers: ["kim"]
  },
  {
    type: "single_choice",
    orderNum: 5,
    content: "Thủ đô của Việt Nam là:",
    options: [
      { label: "A", content: "Huế", isCorrect: false, orderNum: 1 },
      { label: "B", content: "Hà Nội", isCorrect: true, orderNum: 2 },
      { label: "C", content: "Đà Nẵng", isCorrect: false, orderNum: 3 },
      { label: "D", content: "TP.HCM", isCorrect: false, orderNum: 4 }
    ]
  }
];

const seed = async (): Promise<void> => {
  await AppDataSource.initialize();

  const teamRepo = AppDataSource.getRepository(Team);
  const examSetRepo = AppDataSource.getRepository(ExamSet);
  const contestStateRepo = AppDataSource.getRepository(ContestState);
  const questionRepo = AppDataSource.getRepository(Question);
  const optionRepo = AppDataSource.getRepository(Option);
  const fillBlankRepo = AppDataSource.getRepository(FillBlankAnswer);

  // Reset toàn bộ dữ liệu đề seed cũ
  await AppDataSource.query("SET FOREIGN_KEY_CHECKS = 0");
  await fillBlankRepo.clear();
  await optionRepo.clear();
  await questionRepo.clear();
  await examSetRepo.clear();
  await AppDataSource.query("SET FOREIGN_KEY_CHECKS = 1");

  const teamCount = await teamRepo.count();
  if (teamCount === 0) {
    await teamRepo.save(teamRepo.create({ name: "Đội 1", description: "Đội mặc định" }));
  }

  const examSet = await examSetRepo.save(
    examSetRepo.create({
      name: "Đề tiếng Việt mới - 5 câu",
      description: "Bộ đề seed mới gồm 5 câu, có 1 câu ảnh và 1 câu âm thanh.",
      orderNum: 1,
      isActive: true
    })
  );

  for (const item of buildVietnameseSeedQuestions()) {
    const createdQuestion = await questionRepo.save(
      questionRepo.create({
        examSetId: examSet.id,
        type: item.type,
        content: item.content,
        imageUrl: item.imageUrl ?? null,
        audioUrl: item.audioUrl ?? null,
        countdownSeconds: 10,
        score: 1,
        orderNum: item.orderNum
      })
    );

    if (item.options && item.options.length > 0) {
      await optionRepo.save(
        item.options.map((opt) =>
          optionRepo.create({
            questionId: createdQuestion.id,
            label: opt.label,
            content: opt.content,
            isCorrect: opt.isCorrect,
            orderNum: opt.orderNum
          })
        )
      );
    }

    if (item.fillAnswers && item.fillAnswers.length > 0) {
      await fillBlankRepo.save(
        item.fillAnswers.map((acceptedAnswer) =>
          fillBlankRepo.create({
            questionId: createdQuestion.id,
            acceptedAnswer
          })
        )
      );
    }
  }

  const state = await contestStateRepo.findOne({ where: { id: 1 } });
  if (!state) {
    await contestStateRepo.save(
      contestStateRepo.create({
        id: 1,
        screen: "idle",
        currentExamSetId: null,
        currentQuestionId: null,
        isCountdownActive: false,
        countdownEndAt: null,
        rulesContent: null,
        backgroundUrl: null,
        version: 0
      })
    );
  }

  const adminHash = await bcrypt.hash(env.adminPassword, 10);
  logger.info(`Seed complete. Admin login password source set. Hash preview: ${adminHash.slice(0, 10)}...`);

  await AppDataSource.destroy();
};

seed().catch(async (error) => {
  logger.error({ error }, "Seed failed");
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
