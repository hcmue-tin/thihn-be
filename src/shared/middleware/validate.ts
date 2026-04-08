import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { ValidationError } from "../errors/AppError";

type SchemaShape = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

type ValidatedShape = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

declare global {
  namespace Express {
    interface Request {
      validated?: ValidatedShape;
    }
  }
}

export const validate = (schema: SchemaShape) => (req: Request, _res: Response, next: NextFunction): void => {
  const errors: Array<{ field: string; message: string }> = [];
  const validated: ValidatedShape = {};

  const validateOne = (key: keyof SchemaShape): void => {
    const current = schema[key];
    if (!current) {
      return;
    }
    const parsed = current.safeParse(req[key]);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        errors.push({
          field: `${key}.${issue.path.join(".")}`,
          message: issue.message
        });
      });
      return;
    }
    validated[key] = parsed.data;
  };

  validateOne("body");
  validateOne("params");
  validateOne("query");

  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors);
  }
  req.validated = validated;
  next();
};
