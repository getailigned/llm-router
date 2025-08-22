# LLM Router Rules (Customizable)

This document describes the routing rules used by the LLM Router and how you can **customize routing preferences** per tenant, domain, and SLOs without code changes.

> **TL;DR** — Edit `routing_prefs.yaml` to set **objective** (cost/latency/quality), **weights**, allow/deny lists, and per-tenant/domain preferences. The router combines `routing_prefs.yaml` with `policy.yaml` and `pricing.yaml` to choose the **cheapest viable model** by default, unless you override it.

---

## Files that control routing

- **`policy.yaml`** — deterministic _if/then_ rules (e.g., long context → Gemini 2.5 Pro).  
- **`pricing.yaml`** — token prices used to estimate cost.  
- **`routing_prefs.yaml`** ⟵ **your customization layer** (objectives, weights, per-tenant overrides).

Precedence: **hard_constraints > tenant_overrides > global_preferences > policy.yaml**.

---

## Latest Models Supported

### OpenAI / Azure OpenAI
- `gpt-5`
- `gpt-4o`
- `gpt-4o-mini`

### Anthropic
- `claude-opus-4.1`   (deep reasoning)
- `claude-sonnet-4`   (balanced long-context)
- `claude-3-5-sonnet`
- `claude-3-5-haiku`

### Google Gemini 2.5
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite` (preview)

### Open Source / Self-hosted
- `llama-3.1`
- `llama-3.1-70b-local`
- `mistral`

---

## Default Behavior (Cost-first)

- Objective: **cost_first**
- Weights: cost **0.7**, latency **0.2**, accuracy **0.1**
- Default model when nothing special applies: `gpt-4o-mini`

---

## Core Routing Rules (policy.yaml summary)

1. **Multimodal (images/diagrams)** → `gemini-2.5-flash` → fallback `gemini-2.5-pro`  
2. **Very long inputs (≥ 180k tokens)** → `gemini-2.5-pro` → fallback `claude-sonnet-4`  
3. **Coding/tool use** → `gpt-4o-mini` → fallback `gemini-2.5-flash` → escalate `claude-sonnet-4`  
4. **Compliance (NEC/IEC/IEEE)** → `gemini-2.5-flash` + `rag:standards` → fallback `gpt-4o` → escalate `claude-sonnet-4`  
5. **Low-latency SLO (≤ 1200ms)** → `gemini-2.5-flash` → fallback `gpt-4o-mini`  
6. **Deep reasoning** → `claude-sonnet-4` → escalate `claude-opus-4.1`  
7. **Cost tier = low** → `gpt-4o-mini`

---

## Customization via `routing_prefs.yaml`

### Global Objective & Weights
```yaml
global_preferences:
  objective: cost_first        # cost_first | latency_first | quality_first | hybrid
  weights: { cost: 0.7, latency: 0.2, accuracy: 0.1 }
  defaults:
    max_cost_usd: 0.03
    latency_ms: 5000
    confidence_min: 0.6
```

### Tenant Overrides
```yaml
tenant_overrides:
  acme:
    objective: latency_first
    weights: { cost: 0.2, latency: 0.6, accuracy: 0.2 }
    model_preference_order: [ gpt-4o-mini, gemini-2.5-flash, claude-3-5-haiku ]
    domains:
      compliance.nec_iec_ieee:
        objective: hybrid
        preferred_models: [ gemini-2.5-flash ]
        fallback_models:  [ gpt-4o, claude-sonnet-4 ]
        with: [ "rag:standards" ]
```

### Hard Constraints (always enforced)
```yaml
hard_constraints:
  privacy:
    onprem: [ llama-3.1-70b-local ]
  modality:
    image_required: [ gemini-2.5-pro, gpt-4o ]
  context:
    long_context_min_tokens: 180000
    long_context_models: [ gemini-2.5-pro, claude-sonnet-4 ]
```

### Soft Preferences (blocklist/order)
```yaml
model_blocklist: [ ]
model_preference_order:
  - gemini-2.5-flash
  - gpt-4o-mini
  - claude-3-5-haiku
  - gemini-2.5-pro
  - gpt-4o
  - claude-sonnet-4
  - claude-opus-4.1
```

---

## How the router chooses a model

1. Build the **candidate set** from `policy.yaml` rules that match the request.  
2. Apply **hard constraints** (privacy/modality/context window).  
3. Apply **tenant/domain overrides** and **global preferences** (blocklists, ordering).  
4. Score candidates using weights over **expected cost**, **p95 latency**, and **historical accuracy**.  
5. Pick the **lowest score** (cheapest by default), then run fallback/escalation if confidence is low or errors occur.

**Cost estimate** uses `pricing.yaml`. Example scoring (lexicographic):
```
score = (expected_cost, error_rate_past, p95_latency)
```

---

## Environment Variables (customization knobs)

```
COST_TIER_DEFAULT=low                 # bias router to cheap models
MAX_COST_USD=0.02                     # hard per-call budget
ESCALATE_CONFIDENCE_LT=0.65           # escalate if below
ROUTING_PREFS_FILE=routing_prefs.yaml # path to this file
ROUTER_POLICY_FILE=router/policy.yaml
ROUTER_PRICING_FILE=router/pricing.yaml
```

---

## Admin Endpoints (optional)

- `POST /admin/reload` — reload `routing_prefs.yaml` and `policy.yaml` at runtime.  
- `GET  /admin/effective-policy` — returns the merged, effective rules for debugging.  
- `POST /admin/tenant/<id>/override` — set in-memory overrides (persist later if needed).

---

## Example: Shift to latency-first for a week

1) Edit `routing_prefs.yaml`:
```yaml
global_preferences:
  objective: latency_first
  weights: { cost: 0.2, latency: 0.6, accuracy: 0.2 }
```

2) Hit `POST /admin/reload` to apply without restarting.

---

_Last updated: August 2025_