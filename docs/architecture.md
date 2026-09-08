# PactAgent architecture

PactAgent is an application built on Pontmore. The canonical Pontmore PIPs remain the protocol source of truth; application roles, policies, and the `document-summary` lifecycle vocabulary are not new PIPs.

```text
Human intent
     |
     v
P001 Requester ---------------- P002 Provider
     |                                |
     +-------- deterministic policy --+
                       |
                       v
                unsigned action
                       |
                 signing boundary          NOT IMPLEMENTED
                       |
              +--------+--------+
              |                 |
            Nostr             Cashu         NOT CONNECTED
              |                 |
              +---- Pontmore ---+
                  public state
```

## Protocol boundary

The implementation follows the current draft PIPs from [`pontmore/protocol`](https://github.com/pontmore/protocol):

- **PIP-00, kind 30360:** an addressable agent-definition event with `d`, `t=agent`, `relay`, and default-escrow `a` tags. PactAgent uses a documented v1 shape inside the PIP's open `capabilities` field; the detailed P001/P002 policies remain separate application data.
- **PIP-01, kind 30361:** a public escrow compatibility descriptor. The Cashu fixture declares `escrow_type=cashu_escrow`, canonical `networks=[cashu]`, 1-of-1 funding, `pip03` dispute policy, and an opaque reference format. It contains no token, preimage, credential, or private payment payload.
- **PIP-02, kinds 7300–7304 and 30362:** immutable request, transition, evidence, dispute, and note events plus replaceable snapshots. PIP-02 currently specifies transition fields and coherence but not state values; `DocumentSummaryLifecycleState` is therefore explicitly an application vocabulary carried by compliant transition drafts.
- **PIP-03:** operator-governed dispute and timeout rules. PactAgent models the canonical refund-trigger timeout with a non-mutual fallback of cancelling and refunding. AI cannot create resolution modes.

`PontmoreSwapRequestContent` records PIP-02's required kind-7300 fields, but this phase does not synthesize a document-service request event: the current PIP requires `fiat` and `bitcoin` payloads without defining a service-contract encoding. Deferring that event avoids inventing a protocol schema.

The older Pontmore PoCs were inspected as implementation references only. Where they differ from current PIPs—particularly older PIP-01 service fields—the canonical PIPs win.

## Public and private data

Public protocol candidates include agent capabilities, escrow compatibility, agreement references, amounts, lifecycle states, result hashes/references, and settlement outcomes.

Private data includes uploaded documents, raw prompts, complete provider results, sensitive evidence, raw Cashu tokens, mint credentials, preimages, payout instructions, and Nostr private keys. The first pivot phase models no private transport. Future transport should use the PIP-02 companion Gift Wrap lane.

## Authority separation

```text
AI proposal -> deterministic policy -> isolated signer -> protocol action
```

The current implementation stops after deterministic policy and unsigned event drafts. `NostrSigner` is an interface with no private-key implementation. The LLM has no signing or wallet authority.

## Local demo boundary

Fixtures demonstrate one decision: P001 may select P002's `document-summary` offer at 350 sats because it is below P001's 500-sat budget and 450-sat provider-price ceiling, above P002's 200-sat minimum, within both duration limits, and compatible with the declared Cashu escrow.

No generic marketplace, live discovery, reputation, bidding, task execution, automatic settlement, or dispute adjudication is implemented.
