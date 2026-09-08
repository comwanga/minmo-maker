export const MINMO_ENV_NAMES = {
  partnerId: "MINMO_PARTNER_ID",
  apiKey: "MINMO_API_KEY",
} as const;

export interface MinmoConfig {
  partnerId: string;
  apiKey: string;
}

export class MinmoConfigurationError extends Error {
  readonly missingVariables: readonly string[];

  constructor(missingVariables: readonly string[]) {
    super(`Missing required Minmo configuration: ${missingVariables.join(", ")}`);
    this.name = "MinmoConfigurationError";
    this.missingVariables = missingVariables;
  }
}

type Environment = Readonly<Record<string, string | undefined>>;

function readNonEmpty(environment: Environment, name: string): string | undefined {
  const value = environment[name]?.trim();
  return value ? value : undefined;
}

export function isMinmoConfigured(environment: Environment = process.env): boolean {
  return Boolean(
    readNonEmpty(environment, MINMO_ENV_NAMES.partnerId) &&
      readNonEmpty(environment, MINMO_ENV_NAMES.apiKey),
  );
}

export function readMinmoConfig(environment: Environment = process.env): MinmoConfig {
  const partnerId = readNonEmpty(environment, MINMO_ENV_NAMES.partnerId);
  const apiKey = readNonEmpty(environment, MINMO_ENV_NAMES.apiKey);
  const missingVariables = [
    ...(!partnerId ? [MINMO_ENV_NAMES.partnerId] : []),
    ...(!apiKey ? [MINMO_ENV_NAMES.apiKey] : []),
  ];

  if (missingVariables.length > 0) {
    throw new MinmoConfigurationError(missingVariables);
  }

  return { partnerId: partnerId!, apiKey: apiKey! };
}
