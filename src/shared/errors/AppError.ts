export type ErrorField = { field: string; message: string };

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: ErrorField[];

  constructor(message: string, statusCode = 500, errors?: ErrorField[]) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors?: ErrorField[]) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}
