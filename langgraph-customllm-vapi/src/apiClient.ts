import { config } from "./config.js";

/**
 * API Client for making HTTP requests to backend and Legal API.
 * Provides centralized error handling, logging, and type-safe interfaces.
 */

// Base URLs for different services
const BACKEND_BASE = config.backendApiUrl;
const LEGAL_BASE = config.legalApiUrl;

/**
 * API Call Log Entry - tracks requests and responses for debugging
 */
export type ApiCallLog = {
    request: { method: string; url: string; params?: Record<string, string>; body?: unknown };
    response: { status: number; data: unknown };
};

// In-memory store for API call logs (per-conversation)
const apiCallLogStore = { current: null as { apiCalls: ApiCallLog[] } | null };

/**
 * Set the logging store for the current conversation
 */
export function setApiCallLogStore(store: { apiCalls: ApiCallLog[] } | null): void {
    apiCallLogStore.current = store;
}

/**
 * Log an API call (if logging is enabled for this conversation)
 */
function logApiCall(request: ApiCallLog["request"], response: ApiCallLog["response"]): void {
    apiCallLogStore.current?.apiCalls.push({ request, response });
}

/**
 * Helper function to add headers for backend API requests
 */
function backendHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (config.apiKey) headers["x-api-key"] = config.apiKey;
    return headers;
}

/**
 * Generic GET request to backend API
 */
async function getBackend<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = params
        ? `${BACKEND_BASE}${path}?${new URLSearchParams(params).toString()}`
        : `${BACKEND_BASE}${path}`;

    const res = await fetch(url, { headers: backendHeaders() });
    const data = await res.json().catch(() => ({}));

    logApiCall(
        { method: "GET", url, ...(params && Object.keys(params).length > 0 && { params }) },
        { status: res.status, data }
    );

    if (!res.ok) throw new Error((data as { message?: string }).message ?? res.statusText);
    return data as T;
}

/**
 * Generic POST request to backend API
 */
async function postBackend<T>(path: string, body?: unknown): Promise<T> {
    const url = `${BACKEND_BASE}${path}`;
    const res = await fetch(url, {
        method: "POST",
        headers: backendHeaders({ "Content-Type": "application/json" }),
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    logApiCall({ method: "POST", url, body }, { status: res.status, data });

    if (!res.ok) throw new Error((data as { message?: string }).message ?? res.statusText);
    return data as T;
}

/**
 * Generic GET request to Legal API (analytics)
 */
async function getLegal<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = params
        ? `${LEGAL_BASE}${path}?${new URLSearchParams(params).toString()}`
        : `${LEGAL_BASE}${path}`;

    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${config.legalApiKey}`,
            "Content-Type": "application/json"
        }
    });

    const data = await res.json().catch(() => ({}));

    logApiCall(
        { method: "GET", url, ...(params && { params }) },
        { status: res.status, data }
    );

    if (!res.ok) throw new Error((data as { message?: string }).message ?? res.statusText);
    return data as T;
}

// ==================== Type Definitions ====================

export interface AnalyticsSummaryResponse {
    success: boolean;
    data: {
        caseValue?: { avg_case_value: string; total_fee: string; case_count: string };
        PipelineValue?: { total_conservative_attorney_fee: string; total_llf_attorney_fee: string };
        activeCasesCount?: number;
        litigationValue?: { projected_actual_value: string; projected_future_value: string; count: string };
        SettlementValue?: { projected_actual_value: string; projected_future_value: string; count: string };
        prospectCount?: string;
        matterCount?: string;
        demandCount?: string;
        [key: string]: unknown;
    };
    filters?: { startDate: string; endDate: string };
    timestamp?: string;
    source?: string;
}

export interface ActiveCasesResponse {
    success: boolean;
    data: Array<{
        case_id: string;
        client_name: string;
        case_phase: string;
        incident_date?: string;
        projected_value?: string;
        [key: string]: unknown;
    }>;
    pagination?: {
        page: number;
        limit: number;
        hasMore: boolean;
        totalCount: number;
    };
}

// ==================== Public API Functions ====================

/**
 * Get analytics summary for a date range
 */
export function getAnalyticsSummary(params: {
    startDate: string;
    endDate: string;
}): Promise<AnalyticsSummaryResponse> {
    return getLegal<AnalyticsSummaryResponse>("/v1/api/analytics/summary", {
        startDate: params.startDate,
        endDate: params.endDate,
    });
}

/**
 * Get list of active cases for a date range
 */
export function getActiveCases(params: {
    startDate: string;
    endDate: string;
    page?: number;
    limit?: number;
}): Promise<ActiveCasesResponse> {
    const q: Record<string, string> = {
        startDate: params.startDate,
        endDate: params.endDate,
    };
    if (params.page) q.page = String(params.page);
    if (params.limit) q.limit = String(params.limit);

    return getLegal<ActiveCasesResponse>("/v1/api/analytics/active-cases", q);
}

// ==================== Backend API Functions (for appointments, etc.) ====================

/**
 * User lookup response type
 */
export interface UserLookupResponse {
    id: number;
    phone: string;
    name: {
        firstName: string;
        lastName: string;
    };
    dob?: string;
    email?: string;
    [key: string]: unknown;
}

/**
 * Get users by phone number (backend API)
 */
export function getUsersByPhone(phone: string): Promise<UserLookupResponse[]> {
    return getBackend<UserLookupResponse[]>("/users-by-phone", { phone });
}

// Additional backend functions can be added as needed:
// export function getAvailability(...) { return getBackend(...) }
// export function createAppointment(...) { return postBackend(...) }
