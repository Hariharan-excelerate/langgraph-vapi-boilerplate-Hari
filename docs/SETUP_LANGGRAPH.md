# LangGraph (Custom LLM) Setup Guide

Comprehensive setup and documentation for the **LangGraph-based Custom LLM Server** that powers the voice scheduling assistant (e.g. for VAPI). It exposes an OpenAI-compatible `/v1/chat/completions` endpoint and runs a stateful appointment graph (book, reschedule, cancel, register, verify user, org info, etc.).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js (LTS recommended) |
| **Language** | TypeScript |
| **Framework** | Express.js |
| **Graph / Agent** | LangGraph (@langchain/langgraph), @langchain/core |
| **LLM** | Azure OpenAI (via openai SDK); optional security layer: resk-llm-ts |
| **API contract** | OpenAI-compatible chat completions (streaming and non-streaming) |
| **Observability** | LangSmith (optional; LANGSMITH_* env vars) |
| **CLI / Studio** | @langchain/langgraph-cli (dev server for LangGraph Studio) |

---

## What This Service Does

- **Custom LLM server** for voice platforms (e.g. VAPI) that expect an OpenAI-style API.
- **Single endpoint:** `POST /v1/chat/completions` — accepts `messages`, optional `stream`, and optional metadata (e.g. caller phone, call ID).
- **Per-call state:** Each call is identified by a call ID (from header or body). State is stored in memory (or pluggable store) and updated each turn.
- **LangGraph pipeline:** For each request, the server runs a compiled LangGraph that:
  1. Normalizes caller phone and looks up the user (backend caller-id + users).
  2. Greets (personalized or general), confirms identity if needed, or asks how to help.
  3. Detects intent (book, reschedule, cancel, register, org_info, emergency, etc.).
  4. Runs the appropriate flow: **book**, **reschedule**, **cancel**, **register**, **verify user**, **get appointments**, or single-shot nodes (**thanks_end**, **advise_911**, **polite_rejection**, **transfer**, **org_info**).
- **Backend integration:** The graph calls the **Appointment Backend API** (users, organizations, providers, availability, appointments, caller-id) using `MOCK_API_BASE_URL` and optional `APPOINTMENT_API_KEY` (or `MOCK_API_KEY`).

---

## Prerequisites

- **Node.js** 18+ (LTS recommended; use `nvm use --lts` if needed)
- **npm** or **yarn**
- **Backend** running (for caller-id, users, appointments, etc.) — see [SETUP_BACKEND.md](SETUP_BACKEND.md)
- **Azure OpenAI** (or compatible) endpoint and API key for the LLM

---

## Quick Start

```bash
cd langgraph-customllm-vapi
cp .env.example .env
# Edit .env: AZURE_OPENAI_*, MOCK_API_BASE_URL, APPOINTMENT_API_KEY (if backend requires it)
npm install
npm run dev
```

The server listens on **port 6000** by default. It exposes:

- `POST /v1/chat/completions` — OpenAI-compatible chat (used by VAPI / frontend Chat).
- `GET /` — Simple health/info message.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Server

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `6000`) |

### Azure OpenAI (LLM)

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Yes | Deployment/model name |
| `AZURE_OPENAI_API_VERSION` | Yes | API version (e.g. `2024-02-15-preview`) |

### Appointment Backend (Mock EMR API)

| Variable | Required | Description |
|----------|----------|-------------|
| `MOCK_API_BASE_URL` | No | Backend base URL (default: `http://localhost:4000`) |
| `APPOINTMENT_API_KEY` | Conditional | Sent as `x-api-key` when backend `REQUIRE_API_KEY=true`. Alternatively use `MOCK_API_KEY` for the same purpose. |

### Call ID (for state keying)

| Variable | Required | Description |
|----------|----------|-------------|
| `CALL_ID_HEADER` | No | Header name for call ID (default: `x-vapi-call-id`) |
| `CALL_ID_BODY_PATH` | No | JSON path in request body for call ID (e.g. `metadata.vapiCallId`) |

### Clinic / Timezone

| Variable | Required | Description |
|----------|----------|-------------|
| `CLINIC_TIMEZONE` | No | IANA timezone for slot times (default: `America/New_York`) |

### LangSmith (optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `LANGSMITH_API_KEY` | No | LangSmith API key for tracing |
| `LANGSMITH_TRACING_V2` | No | Set to `true` to enable tracing |
| `LANGSMITH_PROJECT` | No | Project name (e.g. `appointment`) |

### Resk (optional security layer)

When `RESK_ENABLED=true`, requests are filtered through `resk-llm-ts` before calling Azure. Set to `false` to call Azure directly.

| Variable | Required | Description |
|----------|----------|-------------|
| `RESK_ENABLED` | No | `true` / `false` (default: `false`) |
| `RESK_*` | No | Prompt injection level, PII redact, content moderation, etc. (see `.env.example`) |

---

## Graph Architecture

The appointment graph is defined in `src/graph/graph.ts` and compiled as `compiledGraph`. The LangGraph Studio config in `langgraph.json` points to `./src/graph/graph.ts:compileGraph`.

### High-level flow

1. **Entry (START → entryRouter)**  
   - First turn (`iteration_count === 1`) → **normalize**.  
   - If step is `ask_are_you_name` or `ask_dob` → **confirm_identity**.  
   - If in verify_user flow with a verify step → **verify_flow**.  
   - If already in booking/registration/reschedule/cancel (mid-flow) → **in_flow_intent_check**.  
   - Otherwise → **detect_intent**.

2. **normalize → lookup**  
   - Normalize raw caller phone; lookup user by phone via backend.

3. **lookup → greet**  
   - User found → **greet_personalized** → END.  
   - User not found → **greet_general** → **mention_services** → (end or **detect_intent**).

4. **confirm_identity**  
   - After confirming identity: **identity_failed_end** | **end** | **register_flow** | **transfer**.

5. **detect_intent**  
   - Intent routing to: thanks_end, advise_911, polite_rejection, transfer, org_info, register_flow, book_flow, reschedule_flow, cancel_flow, get_appointments_flow, verify_flow, or in_flow_intent_check.

6. **in_flow_intent_check**  
   - When already in a flow; may route to thanks_end, transfer, or back into a flow (e.g. reschedule_flow, cancel_flow) via **in_flow_next_route**.

7. **verify_flow**  
   - After verify user: **verifyFlowRouter** → register_flow, transfer, book_flow, reschedule_flow, cancel_flow, get_appointments_flow, or **end**.

8. **Flows** (register_flow, book_flow, reschedule_flow, cancel_flow, get_appointments_flow) and single-shot nodes (thanks_end, advise_911, polite_rejection, transfer, org_info) run then go to **END**. The next user message is a new request and the graph re-enters via **entryRouter**.

### Nodes (summary)

| Node | Purpose |
|------|---------|
| `normalize` | Normalize caller phone from raw input |
| `lookup` | Backend caller-id + user lookup by phone |
| `greet_personalized` / `greet_general` | Greeting; general flow may ask “how may I help” |
| `mention_services` | Offer: book, reschedule, cancel, register |
| `confirm_identity` | Ask “are you X?”, “confirm DOB” when caller ID found |
| `identity_failed_end` | Identity verification failed; end call |
| `detect_intent` | Classify intent (no_request, emergency, book, reschedule, cancel, register, org_info, etc.) |
| `in_flow_intent_check` | Handle mid-flow intents (e.g. switch to cancel or “nothing else”) |
| `thanks_end` | “Thank you, goodbye” |
| `advise_911` | Advise to call 911 |
| `polite_rejection` | Not appointment-related; polite goodbye |
| `transfer` | Transfer to staff |
| `org_info` | Organization hours/location |
| `register_flow` | New user registration (name, DOB, gender, phone, email, confirm) |
| `book_flow` | Get availability → offer slots → confirm → create appointment |
| `reschedule_flow` | List appointments → choose → new slots → confirm → reschedule |
| `cancel_flow` | List appointments → choose → confirm → cancel |
| `get_appointments_flow` | List upcoming appointments |
| `verify_flow` | When user not found by caller ID: name/DOB/phone lookup, then route to register or a booking flow |

---

## State

- **Graph state** is defined by `GraphStateAnnotation` in `src/graph/state.ts`. It includes:
  - `callId`, `rawCallerPhone`, `user_id`, `current_intent`, `messages`, `assistantResponse`, `metadata`, `user`.
- **Inner state** (`metadata.state`) holds per-call/conversation fields: `normalized_phone`, `user_id`, `current_flow`, `flow_data`, `verify_step`, `booking_step`, `_available_slots`, `selected_appointment_id`, `selected_slot_id`, and many step/offer flags used by the nodes.

State is keyed by **call ID** (from request header or body). The server uses an in-memory store (`stateStore.ts`); you can replace it with a persistent store for production.

---

## Running the Server

- **Development:** `npm run dev` or `yarn dev` (runs `tsx src/index.ts`).
- **Production:** `npm run build` then `node dist/index.js` (or use `tsx src/index.ts` if you prefer).

Ensure the **backend** is reachable at `MOCK_API_BASE_URL` and that Azure OpenAI (and optional Resk) env vars are set.

---

## LangGraph Studio (visualize and debug)

You can visualize and run the graph in [LangGraph Studio](https://docs.langchain.com/langsmith/studio) (LangSmith).

### Prerequisites

- [LangSmith](https://smith.langchain.com/) account.
- `LANGSMITH_API_KEY` in `langgraph-customllm-vapi/.env` (from [LangSmith API keys](https://smith.langchain.com/settings)).

### Steps

1. **Install dependencies** (includes LangGraph CLI):
   ```bash
   cd langgraph-customllm-vapi
   npm install
   ```

2. **Start the LangGraph dev server** (no build required; graph is loaded from source):
   ```bash
   npx @langchain/langgraph-cli dev
   ```
   Or: `npm run studio`.

3. **Open Studio**  
   The CLI prints a Studio URL, e.g.:
   ```text
   Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
   ```
   Open it in your browser. The **appointment** graph will appear; you can inspect nodes, run the graph, and view state.

4. **Custom host/port**  
   If the dev server runs elsewhere (e.g. `http://localhost:3000`), use:
   ```text
   https://smith.langchain.com/studio/?baseUrl=http://localhost:3000
   ```

5. **Safari**  
   If you have issues on Safari, start with a tunnel:
   ```bash
   npx @langchain/langgraph-cli dev --tunnel
   ```

### Configuration

- **langgraph.json** points the **appointment** graph to `./src/graph/graph.ts:compileGraph` so the schema is extracted from TypeScript. Using `dist/graph/graph.js` can cause “Failed to extract schema” in some setups.
- The dev server runs the [Agent Server API](https://docs.langchain.com/oss/javascript/langgraph/local-server) on port **2024** by default.

### Notes

- The graph uses **custom state** (not only `MessagesState`). Use **Graph mode** in Studio for full state inspection.
- For runs from Studio, ensure backend and Azure/LLM env vars are set; the graph calls your APIs and LLM.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server (`tsx src/index.ts`) |
| `npm start` | Same as dev |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run studio` | LangGraph Studio dev server (`npx @langchain/langgraph-cli dev`) |
| `npm run test:booking` | Run booking flow test (`tsx scripts/test-booking-flow.ts`) |
| `npm run test:booking:specific-slot` | Run specific-slot booking test |

---

## Project Structure (high level)

```
langgraph-customllm-vapi/
├── langgraph.json           # Studio: graph entry ./src/graph/graph.ts:compileGraph
├── src/
│   ├── index.ts             # Express server, POST /v1/chat/completions, state load/save
│   ├── config.ts            # port, mockApiBaseUrl, apiKey, callId header/body path
│   ├── stateStore.ts        # In-memory (or pluggable) state by callId
│   ├── apiClient.ts         # HTTP client for backend (caller-id, users, appointments, etc.)
│   ├── azureClient.ts       # Azure OpenAI client
│   ├── reskClient.ts / reskConfig.ts  # Optional resk-llm-ts security
│   ├── securityFilter.ts    # Security filtering for LLM
│   ├── graph/
│   │   ├── graph.ts         # StateGraph, nodes, conditional edges, compileGraph
│   │   ├── state.ts         # GraphStateAnnotation, CallStateInner, createInitialCallState
│   │   ├── llm.ts           # LLM used by nodes
│   │   ├── nodes/           # normalize, lookup, greet*, confirmIdentity, detectIntent, flows, etc.
│   │   ├── parseDateTime.ts, parseSlotChoice.ts, formatSlotDate.ts, timezoneHelpers.ts
│   │   └── ...
│   └── prompts/             # repository.ts, verbiage.ts
├── scripts/                 # test-booking-flow.ts, test-booking-specific-slot.ts
├── docs/                    # AGENTIC_SYSTEM_PROMPT, BOOKING_FLOW_TEST, INTENT_DETECTION_FLOW, etc.
├── .env.example
└── package.json
```

---

## API: POST /v1/chat/completions

- **Request:** OpenAI-style body: `model?`, `messages` (required), `stream?`, `metadata?`, `customer?.number?`, etc. Call ID can be in header (`CALL_ID_HEADER`) or body (`CALL_ID_BODY_PATH`).
- **Behavior:** Resolves call ID, loads or creates state, runs `compiledGraph.invoke(state, runConfig)`, saves state, returns last `assistantResponse` as the assistant message.
- **Response:** Same shape as OpenAI chat completions (with or without streaming). Non-2xx on missing/invalid messages, Azure/config errors, or security/rate-limit errors.

---

## Troubleshooting

- **“Missing Azure OpenAI env” / 503:** Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_VERSION` in `.env`.
- **Backend 401:** If backend has `REQUIRE_API_KEY=true`, set `APPOINTMENT_API_KEY` (or `MOCK_API_KEY`) in `.env`.
- **“Failed to extract schema for appointment” in Studio:** Keep `langgraph.json` pointing at `./src/graph/graph.ts:compileGraph`. Do not point at `dist/graph/graph.js` unless necessary (and accept possible schema extraction issues).
- **Wrong @langchain/langgraph-cli version:** Use the version in `package.json` (e.g. `^1.0.0`). Run `npm install` from `langgraph-customllm-vapi/`.

For flow-level details (intents, prompts, slot parsing, etc.), see the docs in `langgraph-customllm-vapi/docs/` (e.g. INTENT_DETECTION_FLOW.md, BOOKING_FLOW_TEST.md, SLOT_PARSING_AND_CLOSEST_MATCH.md).
