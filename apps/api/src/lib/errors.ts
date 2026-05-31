export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export const notFound = (message = 'Not found'): HttpError => new HttpError(404, message);
export const badRequest = (message: string): HttpError => new HttpError(400, message);
