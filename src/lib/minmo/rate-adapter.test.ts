import { Currency } from "@minmoto/sdk";
import { describe, expect, it, vi } from "vitest";

import { MinmoDataUnavailableError } from "../../domain/errors";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ getMinmoClient: vi.fn() }));

import { fetchMinmoBtcKesRate } from "./rate-adapter";

describe("Minmo rate adapter", () => {
  it("uses the verified read-only BTC/KES get method", async () => {
    const get = vi.fn().mockResolvedValue({
      baseCurrency: "BTC",
      targetCurrency: "KES",
      rate: 5_000_000,
      timestamp: "2026-09-08T09:00:00.000Z",
      source: "fixture",
    });

    const result = await fetchMinmoBtcKesRate({ otc: { rates: { get } } });

    expect(get).toHaveBeenCalledExactlyOnceWith(Currency.BTC, Currency.KES);
    expect(result.pair).toBe("BTC/KES");
  });

  it("maps transport failures to a safe unavailable-data error", async () => {
    const get = vi.fn().mockRejectedValue(new Error("sensitive remote details"));
    await expect(fetchMinmoBtcKesRate({ otc: { rates: { get } } })).rejects.toBeInstanceOf(
      MinmoDataUnavailableError,
    );
  });
});
