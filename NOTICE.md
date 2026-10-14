# Provenance

Mini Me Portable adapts the Mini Me domain implementation from the OpenClaw project, distributed under the MIT License. The upstream repository is https://github.com/openclaw/openclaw.

Adapted upstream paths include:

- packages/gateway-protocol/src/schema/closed-object.ts
- packages/gateway-protocol/src/schema/mini-me.ts
- src/mini-me/learning.ts
- src/mini-me/choice.ts
- src/mini-me/prediction.ts
- src/mini-me/documents.ts
- src/mini-me/document-corrections.ts
- src/mini-me/persistence.content-learning.ts
- src/mini-me/persistence.content-sources.ts
- src/mini-me/persistence.content-records.ts
- src/mini-me/persistence.content-read.ts
- assertions from src/mini-me/learning.test.ts, prediction.test.ts, persistence.test.ts, service.test.ts, settled-source.test.ts, and sources.test.ts

The portable package retains the upstream MIT notice in LICENSE. OpenClaw Gateway lifecycle, host filesystem projections, agent/session grants, and action execution were not copied into this package.
