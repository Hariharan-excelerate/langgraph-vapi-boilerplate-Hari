# AI Receptionist - Analytics Service Documentation

**Version:** 1.0  
**Target Audience:** Testing Team  
**Last Updated:** February 10, 2026

---

## Overview

This AI receptionist service provides analytics capabilities for legal case management. The system uses LangGraph to orchestrate conversation flows and delivers business analytics through natural language interactions.

---

## Core Features for Testing

### 1️⃣ **Analytics Summary**
Provides high-level business metrics and summary data.

### 2️⃣ **Thanks Response**
Handles gratitude expressions and conversation endings.

### 3️⃣ **Polite Rejection**
Manages out-of-scope or invalid business requests.

### 4️⃣ **Synthesizer**
Converts raw analytics data into natural, conversational responses.

---

## Setup & Configuration

### Prerequisites
- Node.js 18+ installed
- Legal API credentials
- Environment variables configured

### Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Configure required variables in `.env`:**
   ```env
   # Legal API (Direct Access)
   LEGAL_API_URL=https://osbot.backend.exceleratelegal.com
   LEGAL_API_KEY=your-legal-api-key-here

   # Azure OpenAI
   AZURE_OPENAI_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
   AZURE_OPENAI_API_KEY=your-key-here
   AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
   AZURE_OPENAI_API_VERSION=2025-01-01-preview

   # Server
   PORT=6065
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the service:**
   ```bash
   npm run dev
   ```

The service will start on `http://localhost:6065`

---

## Features Deep Dive

### 📊 Analytics Summary

**Intent:** `analytics_summary`

**Purpose:** Provides business metrics, totals, and summary statistics (NOT detailed case lists).

**Triggers:**
- "Show me analytics summary"
- "What are the total values?"
- "Give me FY 2025 summary"
- "What's the pipeline value?"
- "How many prospects do we have?"

**API Endpoint:** `GET /v1/api/analytics/summary`

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD format
- `endDate` (required): YYYY-MM-DD format

**Example Request:**
```
User: "Show me analytics for last month"
```

**System Flow:**
```
1. Intent Detection → analytics_summary
2. Date Range Extraction → LLM determines date range
3. API Call → Legal API /v1/api/analytics/summary
4. Data Processing → Raw data stored in state
5. Synthesizer → Natural language response
6. Response → User gets conversational summary
```

**Sample Response:**
```
"Here's your analytics summary for January 2025: You have a total pipeline 
value of $2.5M across 45 active cases. The projected settlement value is 
$1.8M with 12 cases in litigation phase. You also have 23 new prospects 
this month."
```

**Testing Scenarios:**

✅ **Scenario 1: Basic Summary Request**
```
Input: "Give me the analytics summary"
Expected: System asks for date range OR uses default
```

✅ **Scenario 2: Date-Specific Request**
```
Input: "Show me analytics for Q1 2025"
Expected: Returns summary for Jan 1 - Mar 31, 2025
```

✅ **Scenario 3: API Failure**
```
Condition: Legal API is down/returns error
Expected: "I couldn't retrieve the analytics data from the system right now."
```

✅ **Scenario 4: Missing Date Context**
```
Input: "Show me the summary" (no date mentioned)
Expected: System asks for clarification on date range
```

**Data Fields Returned:**
- `caseValue`: Average case value, total fees, case count
- `PipelineValue`: Conservative and LLF attorney fees
- `activeCasesCount`: Number of active cases
- `litigationValue`: Projected values and counts
- `SettlementValue`: Settlement projections
- `prospectCount`: Number of prospects
- `matterCount`: Total matters
- `demandCount`: Demand letters count

---

### 🙏 Thanks Response

**Intent:** `no_request`

**Purpose:** Gracefully handles user gratitude and conversation endings.

**Triggers:**
- "Thank you"
- "Thanks"
- "That's all"
- "Nothing else"
- "I'm done"
- "Goodbye"

**System Flow:**
```
1. Intent Detection → no_request
2. Thanks Node → Generates polite closing
3. Response → Conversation ends gracefully
```

**Sample Responses:**
- "You're welcome! Have a great day!"
- "My pleasure! Feel free to reach out anytime."
- "Happy to help! Take care."

**Testing Scenarios:**

✅ **Scenario 1: After Successful Request**
```
User: "Show me analytics for January"
System: [Provides analytics]
User: "Thank you"
Expected: "You're welcome! Have a great day!"
```

✅ **Scenario 2: Immediate Thank You**
```
User: "Thanks"
Expected: Polite closing response
```

---

### ❌ Polite Rejection

**Intent:** `invalid_business`

**Purpose:** Handles requests that are out of scope or not related to legal business.

**Triggers:**
- Wrong number calls
- Sales pitches
- Unrelated inquiries
- Spam

**System Flow:**
```
1. Intent Detection → invalid_business
2. Polite Rejection Node → Generates courteous decline
3. Response → Explains limitation politely
```

**Sample Responses:**
- "I apologize, but I'm designed to assist with legal case analytics and scheduling. Is there something related to your cases I can help you with?"
- "I'm sorry, but that's outside my area. I can help with analytics, appointments, and case information."

**Testing Scenarios:**

✅ **Scenario 1: Off-Topic Request**
```
Input: "Can you order me a pizza?"
Expected: Polite rejection explaining scope
```

✅ **Scenario 2: Sales Pitch**
```
Input: "I'd like to sell you software"
Expected: Polite rejection
```

---

### 🎙️ Synthesizer

**Purpose:** Converts raw analytics data into natural, conversational responses.

**Input:** Raw JSON from Legal API  
**Output:** Natural language summary

**Key Features:**
- ✅ Interprets complex data structures
- ✅ Generates voice-friendly responses
- ✅ Handles missing data gracefully
- ✅ Provides context-aware formatting

**Example Transformation:**

**Raw Data:**
```json
{
  "caseValue": {
    "avg_case_value": "55000",
    "total_fee": "2475000",
    "case_count": "45"
  },
  "activeCasesCount": 45,
  "prospectCount": "23"
}
```

**Synthesized Response:**
```
"You currently have 45 active cases with an average case value of $55,000. 
The total projected fees are $2.47 million. Additionally, you have 23 new 
prospects in the pipeline."
```

**System Prompts Used:**
- Context-aware synthesis
- Financial formatting (currency, decimals)
- Natural number representation
- Tone: Professional, clear, concise

**Testing Scenarios:**

✅ **Scenario 1: Complete Data**
```
Condition: All fields populated
Expected: Comprehensive summary with all metrics
```

✅ **Scenario 2: Partial Data**
```
Condition: Some fields missing
Expected: Summary with available data, no errors
```

✅ **Scenario 3: Error Data**
```
Condition: API returns error
Expected: Error message passed through clearly
```

---

## Testing Endpoints

### Health Check
```bash
GET http://localhost:6065/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T17:00:00.000Z"
}
```

### Main Conversation Endpoint
```bash
POST http://localhost:6065/chat
Content-Type: application/json

{
  "message": "Show me analytics for January 2025",
  "callId": "test-call-123"
}
```

**Expected Response:**
```json
{
  "response": "Here's your analytics summary for January 2025...",
  "metadata": { ... }
}
```

---

## Intent Detection Testing

### How Intent Detection Works

The system uses Azure OpenAI to classify user intent from natural language.

**Supported Intents (For This Release):**
1. `analytics_summary` - Summary metrics and totals
2. `no_request` - Thanks, goodbye, nothing else
3. `invalid_business` - Out of scope requests
4. `greeting` - Hello, hi, good morning

**Not Included in This Release:**
- `active_cases` - Detailed case lists (future feature)
- Appointment booking/scheduling features

### Testing Intent Classification

**Test Cases:**

| User Input | Expected Intent | Expected Action |
|------------|----------------|-----------------|
| "Show me analytics" | `analytics_summary` | Fetch analytics |
| "Thank you" | `no_request` | End conversation |
| "Order pizza" | `invalid_business` | Polite rejection |
| "Hello" | `greeting` | Greeting response |
| "What are the totals?" | `analytics_summary` | Fetch analytics |
| "Give me case statistics" | `analytics_summary` | Fetch analytics |
| "Goodbye" | `no_request` | End conversation |

---

## Architecture Overview

```
┌─────────────────┐
│   User Input    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Intent Detection│ (Azure OpenAI)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route to Node  │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬─────────────┐
    ▼          ▼          ▼             ▼
┌─────────┐ ┌────────┐ ┌──────────┐ ┌────────┐
│Analytics│ │ Thanks │ │ Rejection│ │Greeting│
│ Summary │ │  Node  │ │   Node   │ │  Node  │
└────┬────┘ └────┬───┘ └─────┬────┘ └───┬────┘
     │           │            │           │
     └───────────┴────────────┴───────────┘
                 │
                 ▼
         ┌──────────────┐
         │ Synthesizer  │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │   Response   │
         └──────────────┘
```

### API Client Layer

**Direct Legal API Access** (No backend hop):
```
Analytics Summary → apiClient.getAnalyticsSummary() → Legal API
                    ↑ (type-safe, logged, direct)
```

**Benefits:**
- ✅ Reduced latency (no proxy)
- ✅ Real-time data
- ✅ Automatic API call logging
- ✅ Type-safe interfaces

---

## Error Scenarios

### 1️⃣ Legal API Unavailable
**Response:** "I couldn't retrieve the analytics data from the system right now."

### 2️⃣ Invalid Date Format
**Response:** "I need a valid date range. For example, 'January 2025' or 'last month'."

### 3️⃣ Missing API Credentials
**Response:** Service fails to start with clear error message

### 4️⃣ Azure OpenAI Timeout
**Response:** "I'm having trouble processing that. Please try again."

---

## Test Data Preparation

### Sample Date Ranges for Testing

- **Last Month:** Current month - 1
- **Q1 2025:** January 1 - March 31, 2025
- **FY 2025:** July 1, 2024 - June 30, 2025
- **Year to Date:** Jan 1, 2025 - Current Date

### Sample Test Queries

```bash
# Basic Analytics
"Show me analytics summary"
"Give me the values for last month"
"What are the statistics for Q1?"

# Date-Specific
"Analytics for January 2025"
"Show me data from Jan 1 to Jan 31"
"FY 2025 summary"

# Gratitude/Ending
"Thank you"
"That's all I needed"
"Nothing else, goodbye"

# Invalid Requests
"Book me a flight"
"What's the weather?"
"Order supplies"
```

---

## Debugging & Logs

### Console Log Format

```
[analytics_summary] Fetching analytics data...
[analytics_summary] Date range: 2025-01-01 to 2025-01-31
[analytics_summary] Successfully fetched analytics data
```

### API Call Logging

All API calls are automatically logged:
```typescript
{
  request: {
    method: "GET",
    url: "https://osbot.backend.exceleratelegal.com/v1/api/analytics/summary?...",
    params: { startDate: "2025-01-01", endDate: "2025-01-31" }
  },
  response: {
    status: 200,
    data: { ... }
  }
}
```

---

## Known Limitations

1. **Active Cases Not Included:** Detailed case lists are not part of this release
2. **Date Format:** Only supports YYYY-MM-DD internally
3. **Single Language:** English only
4. **No Streaming:** Responses are complete, not streamed

---

## Support & Contact

**For Testing Issues:**
- Check console logs first
- Verify `.env` configuration
- Confirm Legal API connectivity
- Review intent detection logs

**Environment Variables Checklist:**
- [ ] LEGAL_API_URL configured
- [ ] LEGAL_API_KEY configured
- [ ] Azure OpenAI credentials set
- [ ] PORT set (default: 6065)

---

## Success Criteria

### ✅ Analytics Summary
- [ ] Correctly detects analytics requests
- [ ] Fetches data from Legal API
- [ ] Returns natural language summary
- [ ] Handles date ranges properly
- [ ] Gracefully handles API errors

### ✅ Thanks Response
- [ ] Detects gratitude expressions
- [ ] Provides polite closing
- [ ] Ends conversation gracefully

### ✅ Polite Rejection
- [ ] Identifies invalid requests
- [ ] Responds courteously
- [ ] Explains limitations clearly

### ✅ Synthesizer
- [ ] Converts data to natural language
- [ ] Handles missing data
- [ ] Formats currency correctly
- [ ] Maintains professional tone

---

**End of Documentation**  
_For additional support, contact the development team._
