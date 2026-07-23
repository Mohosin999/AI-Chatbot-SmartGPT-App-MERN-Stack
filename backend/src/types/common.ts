export interface AppError extends Error {
  status?: number;
  errors?: string[];
}
