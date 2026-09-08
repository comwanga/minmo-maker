export class InvalidDomainInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDomainInputError";
  }
}
