import type { UnsignedNostrEvent } from "../domain/nostr";
import type { NostrRelayPublishOptions } from "./nostr-relay";

export function operationOptions(
  defaultTimeoutMs: number,
  options?: NostrRelayPublishOptions,
): NostrRelayPublishOptions {
  return {
    timeoutMs: options?.timeoutMs ?? defaultTimeoutMs,
    signal: options?.signal,
  };
}

export function externalErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export function isTimeoutError(error: unknown): boolean {
  return externalErrorCode(error)?.includes("timeout") === true;
}

export function sameUnsignedEvent(left: UnsignedNostrEvent, right: UnsignedNostrEvent): boolean {
  return (
    left.pubkey === right.pubkey &&
    left.created_at === right.created_at &&
    left.kind === right.kind &&
    left.content === right.content &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags)
  );
}
