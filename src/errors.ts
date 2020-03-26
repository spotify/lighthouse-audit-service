export class StatusCodeError extends Error {
  public statusCode: number = 500;
}

export class InvalidRequestError extends StatusCodeError {
  public statusCode = 400;
}
