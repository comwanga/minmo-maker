export class InvalidDomainInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDomainInputError";
  }
}

export class InsufficientInventoryError extends Error {
  readonly asset: "BTC" | "KES";

  constructor(asset: "BTC" | "KES") {
    super(`Insufficient maker ${asset} inventory for the proposed swap`);
    this.name = "InsufficientInventoryError";
    this.asset = asset;
  }
}

export class InvalidMinmoResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMinmoResponseError";
  }
}

export class MinmoDataUnavailableError extends Error {
  constructor() {
    super("Minmo market data is unavailable");
    this.name = "MinmoDataUnavailableError";
  }
}
