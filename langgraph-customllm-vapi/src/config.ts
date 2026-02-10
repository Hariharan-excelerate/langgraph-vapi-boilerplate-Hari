/**
 * Server and LangGraph config.
 * BACKEND_API_URL: backend API for appointments, users, organizations
 * APPOINTMENT_API_KEY / BACKEND_API_KEY: sent as x-api-key when backend requires API key auth.
 * LEGAL_API_URL: Legal API for analytics (direct access)
 * LEGAL_API_KEY: API key for Legal API authentication
 * CALL_ID_*: how to resolve VAPI call ID from request.
 */
export const config = {
  port: Number(process.env.PORT) || 6000,
  backendApiUrl: (process.env.BACKEND_API_URL || "http://localhost:4000").replace(/\/$/, ""),
  apiKey: process.env.APPOINTMENT_API_KEY || process.env.BACKEND_API_KEY || "",
  legalApiUrl: (process.env.LEGAL_API_URL || "").replace(/\/$/, ""),
  legalApiKey: process.env.LEGAL_API_KEY || "",
  callIdHeader: process.env.CALL_ID_HEADER || "x-vapi-call-id",
  callIdBodyPath: process.env.CALL_ID_BODY_PATH || "metadata.vapiCallId",
};

