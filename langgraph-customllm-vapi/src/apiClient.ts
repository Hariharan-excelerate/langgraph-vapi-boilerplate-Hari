import { config } from "./config.js";

const BASE = config.mockApiBaseUrl;

function requestHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (config.apiKey) headers["x-api-key"] = config.apiKey;
  return headers;
}

export type ApiCallLog = {
  request: { method: string; url: string; params?: Record<string, string>; body?: unknown };
  response: { status: number; data: unknown };
};

const apiCallLogStore = { current: null as { apiCalls: ApiCallLog[] } | null };

export function setApiCallLogStore(store: { apiCalls: ApiCallLog[] } | null): void {
  apiCallLogStore.current = store;
}

function logApiCall(request: ApiCallLog["request"], response: ApiCallLog["response"]): void {
  apiCallLogStore.current?.apiCalls.push({ request, response });
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${BASE}${path}?${new URLSearchParams(params).toString()}`
    : `${BASE}${path}`;
  const res = await fetch(url, { headers: requestHeaders() });
  const data = await res.json().catch(() => ({}));
  logApiCall(
    { method: "GET", url, ...(params && Object.keys(params).length > 0 && { params }) },
    { status: res.status, data }
  );
  if (!res.ok) throw new Error((data as { message?: string }).message ?? res.statusText);
  return data as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  logApiCall({ method: "POST", url, body }, { status: res.status, data });
  if (!res.ok) throw new Error((data as { message?: string }).message ?? res.statusText);
  return data as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  logApiCall({ method: "PATCH", url, body }, { status: res.status, data });
  if (!res.ok) throw new Error((data as { message?: string }).message ?? res.statusText);
  return data as T;
}

export interface NormalizeResult {
  normalizedNumber: string;
  country?: string;
  type?: string;
}

export interface UserByPhone {
  id: number;
  name: { firstName: string; lastName: string };
  dob: string;
  gender: string;
  phone: string;
  status: string;
}

export interface UserFull {
  id: number;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  status: string;
  phone: string;
  email?: string;
  identifiers?: { memberId?: string; externalId?: string | null };
  notes?: string | null;
  flags?: unknown;
}

export interface CreateUserBody {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  insurance?: string;
  chronicConditions?: string;
  allergies?: string;
  externalId?: string;
}

export interface BookingRules {
  acceptingBookings: boolean;
  minDaysInAdvance: number;
  maxDaysInAdvance: number;
  workingHours: Record<string, { start: string; end: string }>;
  allowedVisitTypes: string[];
}

export interface Provider {
  id: number;
  organizationId: number;
  name: string;
  specialty: string;
  language: string;
  gender: string;
}

export interface Slot {
  slotId: number;
  providerId: number;
  start: string;
  end: string;
}

export interface AppointmentPreview {
  adjustedSlot: Slot | null;
  conflicts: unknown[];
  copay?: number;
}

export interface CreateAppointmentBody {
  userId: number;
  organizationId: number;
  providerId: number;
  visitType: string;
  slotId?: number;
  start?: string;
  end?: string;
  reason?: string;
  channel?: string;
}

export interface AppointmentListItem {
  id: number;
  providerName: string;
  organizationName?: string;
  start: string;
  end: string;
  visitType: string;
  status: string;
}

export interface RescheduleOptionsBody {
  preferredDateRange?: { from: string; to: string };
  timeOfDay?: "morning" | "afternoon" | "evening";
  providerPreference?: number;
}

export interface CancelAppointmentBody {
  confirmed: boolean;
  cancellationReason?: string;
}

export function normalizeCallerId(rawNumber: string): Promise<NormalizeResult> {
  return get<NormalizeResult>("/caller-id/normalize", { rawNumber });
}

export function getUsersByPhone(phone: string): Promise<UserByPhone[]> {
  return get<UserByPhone[]>("/users/by-phone", { phone });
}

export function searchUsers(params: {
  name?: string;
  fuzzy?: string;
}): Promise<UserByPhone[]> {
  const q: Record<string, string> = {};
  if (params.name) q.name = params.name;
  if (params.fuzzy) q.fuzzy = params.fuzzy;
  if (Object.keys(q).length === 0) return Promise.resolve([]);
  return get<UserByPhone[]>("/users/search", q);
}

export function getUserById(userId: number): Promise<UserFull> {
  return get<UserFull>(`/users/${userId}`);
}

export function createUser(body: CreateUserBody): Promise<{ userId: number; memberId: string; createdAt: string }> {
  return post<{ userId: number; memberId: string; createdAt: string }>("/users", body);
}

export function validateRegistration(
  userId: number,
  body: CreateUserBody
): Promise<{ valid: boolean; missingFields: string[]; invalidFields: string[] }> {
  return post<{ valid: boolean; missingFields: string[]; invalidFields: string[] }>(
    `/users/${userId}/validate-registration`,
    body
  );
}

export function getBookingRules(orgId: number): Promise<BookingRules> {
  return get<BookingRules>(`/organizations/${orgId}/booking-rules`);
}

export function getProviders(params?: { organizationId?: number; specialty?: string; language?: string; gender?: string }): Promise<Provider[]> {
  const q: Record<string, string> = {};
  if (params?.organizationId != null) q.organizationId = String(params.organizationId);
  if (params?.specialty) q.specialty = params.specialty;
  if (params?.language) q.language = params.language;
  if (params?.gender) q.gender = params.gender;
  return get<Provider[]>("/providers", Object.keys(q).length ? q : undefined);
}

export function getAvailability(params: {
  organizationId: number;
  when?: string;
  fromDate?: string;
  toDate?: string;
  providerId?: number;
  visitType?: string;
  preferredTimeOfDay?: string;
}): Promise<Slot[]> {
  const q: Record<string, string> = { organizationId: String(params.organizationId) };
  if (params.when) q.when = params.when;
  if (params.fromDate) q.fromDate = params.fromDate;
  if (params.toDate) q.toDate = params.toDate;
  if (params.providerId != null) q.providerId = String(params.providerId);
  if (params.visitType) q.visitType = params.visitType;
  if (params.preferredTimeOfDay) q.preferredTimeOfDay = params.preferredTimeOfDay;
  return get<Slot[]>("/availability", q);
}

export function getAppointmentPreview(body: {
  userId: number;
  providerId: number;
  visitType: string;
  desiredTime: string;
}): Promise<AppointmentPreview> {
  return post<AppointmentPreview>("/appointments/preview", body);
}

export function createAppointment(body: CreateAppointmentBody): Promise<{
  appointmentId: number;
  start: string;
  end: string;
  status: string;
}> {
  return post<{ appointmentId: number; start: string; end: string; status: string }>("/appointments", body);
}

export function listAppointments(params?: {
  userId?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
  providerId?: number;
}): Promise<AppointmentListItem[]> {
  const q: Record<string, string> = {};
  if (params?.userId != null) q.userId = String(params.userId);
  if (params?.status) q.status = params.status;
  if (params?.fromDate) q.fromDate = params.fromDate;
  if (params?.toDate) q.toDate = params.toDate;
  if (params?.providerId != null) q.providerId = String(params.providerId);
  return get<AppointmentListItem[]>("/appointments", Object.keys(q).length ? q : undefined);
}

export function getAppointment(appointmentId: number): Promise<unknown> {
  return get<unknown>(`/appointments/${appointmentId}`);
}

export function getRescheduleOptions(
  appointmentId: number,
  body?: RescheduleOptionsBody
): Promise<{ slots: Slot[] }> {
  return post<{ slots: Slot[] }>(`/appointments/${appointmentId}/reschedule-options`, body ?? {});
}

export function rescheduleAppointment(
  appointmentId: number,
  body: { newSlotId?: number; newStart?: string; newEnd?: string; reason?: string; updatedMetadata?: unknown }
): Promise<unknown> {
  return patch<unknown>(`/appointments/${appointmentId}`, body);
}

export function getCancelOptions(userId: number): Promise<AppointmentListItem[]> {
  return post<AppointmentListItem[]>("/appointments/cancel-options", { userId });
}

export function cancelAppointment(
  appointmentId: number,
  body: CancelAppointmentBody
): Promise<{ status: string; penalty?: { amount: number; currency: string } | null }> {
  return post<{ status: string; penalty?: { amount: number; currency: string } | null }>(
    `/appointments/${appointmentId}/cancel`,
    body
  );
}

export interface AnalyticsSummaryResponse {
  success: boolean;
  data: {
    caseValue: {
      avg_case_value: string | null;
      total_fee: string | null;
      case_count: string;
    };
    PipelineValue: {
      total_conservative_attorney_fee: string | null;
      total_llf_attorney_fee: string | null;
    };
    caseValues: Array<{
      projected_actual_value: string | null;
      projected_future_value: string | null;
      case_phase: string | null;
    }>;
    litigationValue: {
      projected_actual_value?: string;
      projected_future_value?: string;
      count?: string;
    };
    SettlementValue: {
      projected_actual_value?: string;
      projected_future_value?: string;
      count?: string;
    };
    prospectCount: string;
    matterCount: string;
    demandCount: string;
    activeCasesCount: number;
    activeCasesByPhase: Record<string, number>;
    casePhases: Record<string, string>;
    treatmentLevels: Record<string, string>;
  };
  filters: {
    startDate: string;
    endDate: string;
  };
  timestamp: string;
}

export interface ActiveCasesResponse {
  success: boolean;
  data: any[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
    totalCount: number;
  };
  timestamp: string;
}

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

  return get<ActiveCasesResponse>("/v1/api/analytics/active-cases", q);
}

export function getAnalyticsSummary(params: {
  startDate: string;
  endDate: string;
}): Promise<AnalyticsSummaryResponse> {
  return get<AnalyticsSummaryResponse>("/v1/api/analytics/summary", {
    startDate: params.startDate,
    endDate: params.endDate,
  });
}
