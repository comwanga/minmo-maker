import { describe, expect, it } from "vitest";

import { InvalidDomainInputError } from "./errors";
import { createNostrIdentity, parseUnsignedNostrEvent, serializeUnsignedNostrEvent } from "./nostr";
import { parsePontmoreAgentDefinition, PIP00_AGENT_DEFINITION_KIND } from "./pontmore-agent";
import { createPactDemoFixtures } from "../lib/pact-fixtures";

describe("PIP-00 PactAgent definitions", () => {
  it("creates valid, independent P001 and P002 definitions", () => {
    const { requester, provider } = createPactDemoFixtures();

    expect(requester.id).toBe("P001");
    expect(provider.id).toBe("P002");
    expect(requester.identity.publicKey).not.toBe(provider.identity.publicKey);
    expect(requester.definition.event.kind).toBe(PIP00_AGENT_DEFINITION_KIND);
    expect(provider.definition.event.kind).toBe(PIP00_AGENT_DEFINITION_KIND);
    expect(requester.definition.event.tags).toContainEqual(["t", "agent"]);
    expect(provider.definition.content.capabilities.names).toContain("document-summary");
  });

  it("round-trips an application-owned unsigned PIP-00 event", () => {
    const { provider } = createPactDemoFixtures();
    const serialized = serializeUnsignedNostrEvent(provider.definition.event);
    const parsed = parsePontmoreAgentDefinition(serialized);

    expect(parsed).toEqual(provider.definition);
    expect(parseUnsignedNostrEvent(serialized)).not.toHaveProperty("privateKey");
  });

  it("rejects private key material and malformed Nostr identities", () => {
    expect(() => createNostrIdentity("not-a-key", ["wss://relay.example"])).toThrow(
      InvalidDomainInputError,
    );
    const { provider } = createPactDemoFixtures();
    const unsafe = JSON.stringify({ ...provider.definition.event, privateKey: "secret" });
    expect(() => parseUnsignedNostrEvent(unsafe)).toThrow(InvalidDomainInputError);
  });

  it("rejects a PIP-00 definition without its required escrow tag", () => {
    const { provider } = createPactDemoFixtures();
    const event = { ...provider.definition.event, tags: provider.definition.event.tags.filter((tag) => tag[0] !== "a") };
    expect(() => parsePontmoreAgentDefinition(JSON.stringify(event))).toThrow(InvalidDomainInputError);
  });
});
