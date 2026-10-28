export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message);
