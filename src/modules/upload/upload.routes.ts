import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authenticate, requireAdmin } from "../../shared/middleware/auth";
import { ValidationError } from "../../shared/errors/AppError";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const imageDir = path.join(uploadRoot, "images");
const audioDir = path.join(uploadRoot, "audio");

const ensureUploadDirs = (): void => {
  fs.mkdirSync(imageDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });
};

ensureUploadDirs();

const audioExt = /\.(mp3|wav|m4a|aac|ogg|opus|webm|flac)$/i;

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, imageDir);
      return;
    }
    if (file.mimetype.startsWith("audio/") || audioExt.test(file.originalname)) {
      cb(null, audioDir);
      return;
    }
    cb(new ValidationError("Định dạng tệp không hỗ trợ"), "");
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext.toLowerCase()}`;
    cb(null, safeName);
  }
});

const uploader = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

export const uploadRouter = Router();

uploadRouter.use(authenticate, requireAdmin);

uploadRouter.post("/upload", uploader.single("file"), (req, res) => {
  const file = req.file;
  if (!file) {
    throw new ValidationError("Thiếu tệp tải lên");
  }

  const host = `${req.protocol}://${req.get("host")}`;
  const normalizedPath = file.path.replace(/\\/g, "/");
  const relativePath = normalizedPath.includes("/uploads/") ? normalizedPath.split("/uploads/")[1] : path.basename(normalizedPath);
  const fileUrl = `${host}/uploads/${relativePath}`;
  const kind = file.mimetype.startsWith("image/") ? "image" : "audio";
  if (kind === "audio" && !file.mimetype.startsWith("audio/")) {
    res.setHeader("X-Upload-Note", "filename-extension-audio");
  }

  res.json({
    success: true,
    data: {
      kind,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      fileName: file.filename,
      fileUrl
    }
  });
});
