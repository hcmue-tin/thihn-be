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

const buildSampleQuestions = (): SeedQuestion[] => [
  {
    type: "true_false",
    orderNum: 1,
    content: "“翁”“朋”“工”三个字的韵母是一样的，都是“ong”。",
    options: [
      { label: "A", content: "正确", isCorrect: false, orderNum: 1 },
      { label: "B", content: "错误", isCorrect: true, orderNum: 2 }
    ]
  },
  {
    type: "single_choice",
    orderNum: 2,
    content: "“吹、成、齿、处”这一组字的声母相同，都是“_______”。",
    options: [
      { label: "A", content: "ch", isCorrect: true, orderNum: 1 },
      { label: "B", content: "zh", isCorrect: false, orderNum: 2 },
      { label: "C", content: "z", isCorrect: false, orderNum: 3 },
      { label: "D", content: "c", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "fill_blank",
    orderNum: 3,
    content:
      "汉语成语“          ”，原指“住在井底的青蛙永远只能看到井口那么大的一块天”。常用来比喻见识狭窄的人。",
    options: [
      { label: "A", content: "井底之蛙", isCorrect: true, orderNum: 1 },
      { label: "B", content: "花花公子", isCorrect: false, orderNum: 2 },
      { label: "C", content: "绘声绘影", isCorrect: false, orderNum: 3 },
      { label: "D", content: "国色天香", isCorrect: false, orderNum: 4 }
    ],
    fillAnswers: ["井底之蛙"]
  },
  {
    type: "ordering",
    orderNum: 4,
    content: "Sắp xếp theo thứ tự đúng (nhập dạng BDCA). A.殿试第一名叫状元 B.科举考试分四个等级 C.会试第一名叫会元 D.乡试第一名叫解元",
    options: [
      { label: "A", content: "殿试第一名叫状元", isCorrect: false, orderNum: 1 },
      { label: "B", content: "科举考试分四个等级", isCorrect: false, orderNum: 2 },
      { label: "C", content: "会试第一名叫会元", isCorrect: false, orderNum: 3 },
      { label: "D", content: "乡试第一名叫解元", isCorrect: false, orderNum: 4 }
    ],
    fillAnswers: ["BDCA"]
  },
  {
    type: "matching",
    orderNum: 5,
    content:
      "请为下面的名词选择合适的量词并连接：(1)一列 (2)一扇 (3)一台 (4)一场 (5)一道 | A.电脑 B.彩虹 C.火车 D.木门 E.大雨 (nhập dạng 1:C;2:D;3:A;4:E;5:B)",
    fillAnswers: ["1:C;2:D;3:A;4:E;5:B", "1.C;2.D;3.A;4.E;5.B"]
  },
  {
    type: "listening_choice",
    orderNum: 6,
    content: "Nghe file âm thanh và chọn đáp án đúng.",
    audioUrl: "/uploads/audio/sample-listening-1.mp3",
    options: [
      { label: "A", content: "礼貌地打招呼而已", isCorrect: true, orderNum: 1 },
      { label: "B", content: "希望交流个人信息", isCorrect: false, orderNum: 2 },
      { label: "C", content: "熟人之间并无秘密", isCorrect: false, orderNum: 3 },
      { label: "D", content: "非常关注他人生活", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "true_false",
    orderNum: 7,
    content: "“中国的首都是北京。”",
    options: [
      { label: "A", content: "正确", isCorrect: true, orderNum: 1 },
      { label: "B", content: "错误", isCorrect: false, orderNum: 2 }
    ]
  },
  {
    type: "single_choice",
    orderNum: 8,
    content: "“他每天___七点起床。” 请选择最合适的词。",
    options: [
      { label: "A", content: "在", isCorrect: true, orderNum: 1 },
      { label: "B", content: "跟", isCorrect: false, orderNum: 2 },
      { label: "C", content: "把", isCorrect: false, orderNum: 3 },
      { label: "D", content: "被", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "fill_blank",
    orderNum: 9,
    content: "Điền thành ngữ phù hợp: “__________” (ý nói làm việc nửa chừng thì bỏ dở).",
    options: [
      { label: "A", content: "半途而废", isCorrect: true, orderNum: 1 },
      { label: "B", content: "一举两得", isCorrect: false, orderNum: 2 },
      { label: "C", content: "画蛇添足", isCorrect: false, orderNum: 3 },
      { label: "D", content: "自相矛盾", isCorrect: false, orderNum: 4 }
    ],
    fillAnswers: ["半途而废"]
  },
  {
    type: "listening_choice",
    orderNum: 10,
    content: "Nghe file âm thanh và chọn ý chính của hội thoại.",
    audioUrl: "/uploads/audio/sample-listening-2.mp3",
    options: [
      { label: "A", content: "讨论周末旅游计划", isCorrect: false, orderNum: 1 },
      { label: "B", content: "预约看病时间", isCorrect: true, orderNum: 2 },
      { label: "C", content: "询问商品价格", isCorrect: false, orderNum: 3 },
      { label: "D", content: "介绍新同学", isCorrect: false, orderNum: 4 }
    ]
  }
];

const buildVietnameseSampleQuestions = (): SeedQuestion[] => [
  {
    type: "true_false",
    orderNum: 1,
    content: "Mặt trời mọc ở hướng Tây.",
    options: [
      { label: "A", content: "Đúng", isCorrect: false, orderNum: 1 },
      { label: "B", content: "Sai", isCorrect: true, orderNum: 2 }
    ]
  },
  {
    type: "single_choice",
    orderNum: 2,
    content: "Thủ đô của Việt Nam là:",
    options: [
      { label: "A", content: "Hà Nội", isCorrect: true, orderNum: 1 },
      { label: "B", content: "Huế", isCorrect: false, orderNum: 2 },
      { label: "C", content: "Đà Nẵng", isCorrect: false, orderNum: 3 },
      { label: "D", content: "TP.HCM", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "fill_blank",
    orderNum: 3,
    content: "Điền vào chỗ trống: “Có công mài sắt, có ngày nên ____”.",
    options: [
      { label: "A", content: "kim", isCorrect: true, orderNum: 1 },
      { label: "B", content: "dao", isCorrect: false, orderNum: 2 },
      { label: "C", content: "kiếm", isCorrect: false, orderNum: 3 },
      { label: "D", content: "gươm", isCorrect: false, orderNum: 4 }
    ],
    fillAnswers: ["kim"]
  },
  {
    type: "ordering",
    orderNum: 4,
    content: "Sắp xếp quy trình nấu cơm đúng thứ tự. A. Cắm điện B. Vo gạo C. Cho gạo vào nồi D. Chờ cơm chín",
    options: [
      { label: "A", content: "Cắm điện", isCorrect: false, orderNum: 1 },
      { label: "B", content: "Vo gạo", isCorrect: false, orderNum: 2 },
      { label: "C", content: "Cho gạo vào nồi", isCorrect: false, orderNum: 3 },
      { label: "D", content: "Chờ cơm chín", isCorrect: false, orderNum: 4 }
    ],
    fillAnswers: ["BCAD"]
  },
  {
    type: "matching",
    orderNum: 5,
    content: "Nối tỉnh thành với vùng miền: (1) Hà Nội (2) Đà Nẵng (3) Cần Thơ | A. Miền Trung B. Miền Nam C. Miền Bắc",
    fillAnswers: ["1:C;2:A;3:B"]
  },
  {
    type: "listening_choice",
    orderNum: 6,
    content: "Nghe file âm thanh và chọn ý đúng nhất.",
    audioUrl: "/uploads/audio/sample-vn-1.mp3",
    options: [
      { label: "A", content: "Nhắc lịch họp lúc 8 giờ", isCorrect: true, orderNum: 1 },
      { label: "B", content: "Mời đi du lịch", isCorrect: false, orderNum: 2 },
      { label: "C", content: "Thông báo nghỉ học", isCorrect: false, orderNum: 3 },
      { label: "D", content: "Hỏi đường đi", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "true_false",
    orderNum: 7,
    content: "2 + 2 = 4.",
    options: [
      { label: "A", content: "Đúng", isCorrect: true, orderNum: 1 },
      { label: "B", content: "Sai", isCorrect: false, orderNum: 2 }
    ]
  },
  {
    type: "single_choice",
    orderNum: 8,
    content: "Trong tuần có bao nhiêu ngày?",
    options: [
      { label: "A", content: "5", isCorrect: false, orderNum: 1 },
      { label: "B", content: "6", isCorrect: false, orderNum: 2 },
      { label: "C", content: "7", isCorrect: true, orderNum: 3 },
      { label: "D", content: "8", isCorrect: false, orderNum: 4 }
    ]
  },
  {
    type: "fill_blank",
    orderNum: 9,
    content: "Điền từ còn thiếu: “Uống nước nhớ ____”.",
    options: [
      { label: "A", content: "nguồn", isCorrect: true, orderNum: 1 },
      { label: "B", content: "sông", isCorrect: false, orderNum: 2 },
      { label: "C", content: "biển", isCorrect: false, orderNum: 3 },
      { label: "D", content: "suối", isCorrect: false, orderNum: 4 }
    ],
    fillAnswers: ["nguon", "nguồn"]
  },
  {
    type: "listening_choice",
    orderNum: 10,
    content: "Nghe file âm thanh và chọn đáp án đúng.",
    audioUrl: "/uploads/audio/sample-vn-2.mp3",
    options: [
      { label: "A", content: "Đặt đồ ăn tối", isCorrect: false, orderNum: 1 },
      { label: "B", content: "Nhắc nộp bài tập trước 17h", isCorrect: true, orderNum: 2 },
      { label: "C", content: "Báo hủy buổi học", isCorrect: false, orderNum: 3 },
      { label: "D", content: "Xin nghỉ phép", isCorrect: false, orderNum: 4 }
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

  const teamCount = await teamRepo.count();
  if (teamCount === 0) {
    await teamRepo.save(teamRepo.create({ name: "Team 1", description: "Default seeded team" }));
  }

  const examSetCount = await examSetRepo.count();
  if (examSetCount === 0) {
    await examSetRepo.save(examSetRepo.create({ name: "Bo de 1", description: "Default seeded exam set", orderNum: 1 }));
  }

  const seedExamSetWithQuestions = async (
    name: string,
    description: string,
    orderNum: number,
    questions: SeedQuestion[],
    isActive = false
  ): Promise<void> => {
    let exam = await examSetRepo.findOne({ where: { name } });
    if (!exam) {
      exam = await examSetRepo.save(
        examSetRepo.create({
          name,
          description,
          orderNum,
          isActive
        })
      );
    }

    const existingQuestionCount = await questionRepo.count({ where: { examSetId: exam.id } });
    if (existingQuestionCount > 0) return;

    for (const item of questions) {
      const createdQuestion = await questionRepo.save(
        questionRepo.create({
          examSetId: exam.id,
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
  };

  await seedExamSetWithQuestions(
    "Nhịp Cầu Hán Ngữ 2026 - Bộ đề mẫu",
    "Mỗi bộ đề 10 câu, mỗi câu 1 điểm, 10 giây suy nghĩ.",
    2026,
    buildSampleQuestions(),
    true
  );

  await seedExamSetWithQuestions(
    "Bộ đề test tiếng Việt - Demo",
    "Bộ đề tiếng Việt để test nhanh giao diện và luồng realtime.",
    2027,
    buildVietnameseSampleQuestions(),
    false
  );

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
