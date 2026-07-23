import { AppError } from "../types/common";

const notFound = (msg = "Resource not found"): AppError => {
  const error: AppError = new Error(msg);
  error.status = 404;
  return error;
};

const badRequest = (msg = "Bad Request"): AppError => {
  const error: AppError = new Error(msg);
  error.status = 400;
  return error;
};

const serverError = (msg = "Internal Server Error"): AppError => {
  const error: AppError = new Error(msg);
  error.status = 500;
  return error;
};

const authenticationError = (msg = "Authentication Failed"): AppError => {
  const error: AppError = new Error(msg);
  error.status = 401;
  return error;
};

const authorizationError = (msg = "Permission Denied"): AppError => {
  const error: AppError = new Error(msg);
  error.status = 403;
  return error;
};

export {
  notFound,
  badRequest,
  serverError,
  authenticationError,
  authorizationError,
};
