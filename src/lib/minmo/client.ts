import "server-only";

import { MinmoClient } from "@minmoto/sdk";

import { readMinmoConfig } from "./config";

let client: MinmoClient | undefined;

/** Returns the single server-side SDK client without logging its credentials. */
export function getMinmoClient(): MinmoClient {
  client ??= new MinmoClient(readMinmoConfig());
  return client;
}
