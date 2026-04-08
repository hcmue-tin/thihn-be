import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";

export type JwtUser = JwtPayload & {
  role: "admin" | "contestant";
  actor?: string;
  contestantId?: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing bearer token");
  }

  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, env.jwtSecret) as JwtUser;
    next();
  } catch {
    throw new UnauthorizedError("Invalid token");
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== "admin") {
    throw new ForbiddenError("Admin access required");
  }
  next();
};
