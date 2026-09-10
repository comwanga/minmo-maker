# PIP-01 Cashu escrow descriptor flow

PactAgent publishes public compatibility metadata for its Cashu escrow mechanism
as a Nostr addressable event of kind `30361`. The descriptor tells another agent
whether the mechanism is compatible; it does not hold or move funds.

## Public wire shape

The descriptor content implemented by PactAgent is:

```json
{
  "version": 1,
  "escrow_type": "cashu_escrow",
  "networks": ["cashu"],
  "funding_rules": {
    "funding_threshold": 1,
    "participant_count": 1
  },
  "dispute_rules": {
    "policy": "pip03",
    "timeout": {
      "class": "refund-trigger timeout",
      "duration_seconds": 900,
      "fallback_resolution": "cancelling and refunding"
    }
  },
  "reference_format": "opaque_service_reference",
  "updated_at": 1788853200
}
```

The event has one stable `d` tag and a `network` index tag:

```text
["d", "cashu-document-summary"]
["network", "cashu"]
```

PIP-01 standardizes the minimum top-level content, `pip03` policy identifier,
network declaration, funding cardinality, and addressable event. Draft PIP-01
requires a declared fallback for any advertised timeout but does not currently
standardize the timeout JSON field names. The nested `dispute_rules.timeout`
object above is therefore a versioned PactAgent convention that directly mirrors
the project's existing PIP-03 timeout policy. It is not presented as a new
Pontmore-standard field.

PactAgent currently supports one Cashu network entry, 1-of-1 funding, the `pip03`
policy, a refund-trigger timeout, and `opaque_service_reference`. It does not add
an optional PIP-01 service-schema pointer because no escrow service is implemented.

## PIP-00 reference and resolution

The descriptor's Nostr address is:

```text
30361:<descriptor-author-pubkey>:<d-tag-value>
```

A PIP-00 definition stores that address in both `content.escrow` and its `a` tag.
Resolution parses the address, queries the relay with kind `30361`, the referenced
author, and the referenced `d` value, then validates the current matching event.
The relationship therefore survives serialization and relay transport and is not
an in-memory object link.

## Signing and relay boundaries

The flow is:

```text
Cashu descriptor model
  -> unsigned kind 30361 event
  -> NostrSigner
  -> verify unchanged draft, event id, and Schnorr signature
  -> relay publish
  -> query by address
  -> verify signature and strict descriptor parse
  -> resolve from PIP-00 reference
```

Descriptor code receives only an unsigned event and a `NostrSigner`; it has no API
for fetching or returning secret keys. The relay receives only signed events. The
publication flow uses the `NostrRelayAdapter` delivered by issue #4 directly,
while the production signer remains the responsibility of issue #6. Tests use a
synthetic key held inside a local test signer and an in-memory relay, so CI does
not need public infrastructure or credentials.

The caller owns the adapter lifecycle: connect before publish or retrieval and
disconnect after the bounded operation. PIP-01 orchestration does not create a
background relay connection.

## Public/private boundary

Construction and parsing use allowlisted public fields and explicitly reject
Cashu token strings, proofs, mint or API credentials, private or Nostr secret keys,
preimages, payout instructions, private routing data, custody identifiers, private
settlement metadata and secrets, and private notes. Errors expose typed categories
and do not include rejected payloads or transport internals.

The public descriptor contains no token creation, redemption, swapping, proof
storage, funding, release, refund, wallet, mint connection, private task transport,
or dispute adjudication behavior. Those remain later settlement and transport
issues.
