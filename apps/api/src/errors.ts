// Domain errors carry their HTTP status, so services stay HTTP-agnostic in their logic while the
// single error handler in app.ts maps every failure to the `{ detail }` body the web app expects.

export class DomainError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** Also used for resources the caller may not see, so their existence is not revealed. */
export class NotFoundError extends DomainError {
  constructor(message = "Not found") {
    super(message, 404)
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 422)
  }
}

/** A dependency we call (the agent runtime, an MCP server) failed. */
export class UpstreamError extends DomainError {
  constructor(message: string) {
    super(message, 502)
  }
}
