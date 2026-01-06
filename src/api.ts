// src/api.ts

export const API_BASE = (
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "http://localhost:8000"
).replace(/\/+$/, "");


// ---------- Types & runtime exports ----------

export type Role = "supervisor" | "tester";

export interface LoginResponse {
  access_token: string;
  role: Role;
  user: { id: string; name: string; role: Role };
}

// This is the shape used by UnitCard and units dashboard
export interface UnitSummary {
  unit_id: string;
  status: string;
  progress_percent: number;
  passed_steps: number;
  total_steps: number;
  next_step_id?: number;
  next_step_name?: string;
}

// Dummy runtime export so any `import { UnitSummary }` succeeds.
export const UnitSummary = {} as UnitSummary;

export interface TestStep {
  id: number;
  name: string;
  order: number;
  required: boolean;
  metrics_hint?: string | null;
  limit_metric?: string | null;
  limit_comp?: string | null;
  limit_value?: number | null;
}

export interface Assignment {
  id: string;
  unit_id: string;
  step_id: number;
  tester_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  status: string;
  prev_passed?: boolean;
}

export interface Result {
  id: string;
  unit_id: string;
  step_id: number;
  passed: boolean;
  metrics: Record<string, any>;
  files: string[];
  submitted_by?: string;
  finished_at: string;
}

export interface UnitDetails {
  unit: {
    id: string;
    sku?: string;
    rev?: string;
    lot?: string;
    status: string;
    current_step_id?: number;
  };
  assignments: Assignment[];
  results: Result[];
}

export interface TesterTask {
  assignment: Assignment;
  step: TestStep;
  reasons_blocked: string[];
}

export interface TesterQueueResponse {
  ready: TesterTask[];
  blocked: TesterTask[];
}

export function setTesterAssignmentStatus(
  assignmentId: string,
  status: "RUNNING" | "PENDING"
): Promise<Assignment> {
  return request(`/tester/assignments/${assignmentId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
// ---------- Notifications ----------

export interface Notification {
  id: string;
  tester_id: string;
  unit_id: string;
  from_step_id: number;
  to_step_id: number;
  message: string;
  created_at: string; // ISO string
  read: boolean;
}

// 🔹 NEW: tester group type (name -> list of testers)
export type TesterGroups = Record<string, string[]>;

// ---------- Token & user helpers ----------

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export function getRole(): Role | null {
  return (localStorage.getItem("role") as Role) || null;
}

export function setRole(role: Role | null) {
  if (role) localStorage.setItem("role", role);
  else localStorage.removeItem("role");
}

export type UserInfo = { id: string; name: string; role: Role };

export function setUser(user: UserInfo | null) {
  if (user) localStorage.setItem("user", JSON.stringify(user));
  else localStorage.removeItem("user");
}

export function getUser(): UserInfo | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

// ---------- Generic request wrapper ----------

// 🔹 CHANGE: export this so hooks.ts can use it
export async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) (headers as any).Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text as any;
  }
}


// ---------- Auth ----------

export async function login(name: string): Promise<LoginResponse> {
  const resp = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const typed = resp as LoginResponse;
  setToken(typed.access_token);
  setRole(typed.role);
  setUser(typed.user);
  return typed;
}

// ---------- API functions ----------

export function fetchUnitSummaries(): Promise<UnitSummary[]> {
  return request("/units/summary");
}

export function fetchUnitDetails(id: string): Promise<UnitDetails> {
  return request(`/units/${id}/details`);
}

export function fetchSteps(): Promise<TestStep[]> {
  return request("/steps");
}

export function fetchTesterQueue(
  testerId: string
): Promise<TesterQueueResponse> {
  const query = new URLSearchParams({ tester_id: testerId });
  return request(`/tester/queue?${query.toString()}`);
}

export function fetchAssignmentsSchedule(): Promise<Assignment[]> {
  return request("/assignments/schedule");
}

export function fetchTesters(): Promise<string[]> {
  return request("/testers");
}

export function fetchTesterAssignments(
  testerId: string
): Promise<Assignment[]> {
  const params = new URLSearchParams({ tester_id: testerId });
  return request(`/tester/assignments?${params.toString()}`);
}

export interface AssignmentUpdate {
  tester_id?: string;
  status?: string;
  start_at?: string | null;
  end_at?: string | null;
}

export function updateAssignment(id: string, data: AssignmentUpdate) {
  return request(`/assignments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function createUnit(unit_id: string) {
  return request("/units", {
    method: "POST",
    body: JSON.stringify({ unit_id }),
  });
}

export function deleteUnit(unit_id: string) {
  return request(`/units/${unit_id}`, {
    method: "DELETE",
  });
}

export function createResult(payload: {
  unit_id: string;
  step_id: number;
  metrics: Record<string, any>;
  passed?: boolean;
  finished_at?: string; // ISO datetime string, optional
}) {
  return request("/results", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


// ---------- File upload (multipart) ----------

export async function uploadEvidence(
  unit_id: string,
  step_id: number,
  result_id: string,
  file: File
) {
  const token = getToken();
  const formData = new FormData();
  formData.append("unit_id", unit_id);
  formData.append("step_id", String(step_id));
  formData.append("result_id", result_id);
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// ---------- Notifications API ----------

export function getTesterNotifications(
  testerId: string,
  unreadOnly = false
): Promise<Notification[]> {
  const params = new URLSearchParams({ tester_id: testerId });
  if (unreadOnly) params.append("unread_only", "true");
  return request(`/tester/notifications?${params.toString()}`);
}

export function markNotificationRead(notifId: string): Promise<null> {
  return request(`/tester/notifications/${notifId}/read`, {
    method: "POST",
  });
}

export interface DuplicateRequest {
  source_unit_id: string;
  new_unit_ids: string[];
  day_shift?: number;
}

export async function duplicateSchedule(
  payload: DuplicateRequest
): Promise<{ ok: boolean; created_units: string[] }> {
  return request("/schedule/duplicate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchTesterGroups(): Promise<Record<string, string[]>> {
  return request("/testers/groups");
}



