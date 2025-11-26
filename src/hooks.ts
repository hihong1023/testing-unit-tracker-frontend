// src/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getToken } from "./api";
import type { Assignment } from "./api";

import {
  fetchUnitSummaries,
  fetchUnitDetails,
  fetchTesterQueue,
  fetchTesterAssignments,
  fetchSteps,
  createUnit,
  createResult,
  fetchAssignmentsSchedule,
  updateAssignment,
  fetchTesters,
  getRole,
  getTesterNotifications, // NEW
  deleteUnit,             // moved up here
} from "./api";
import type { Notification } from "./api"; // NEW

// Polling intervals (ms)
const UNITS_REFRESH_MS = 10000; // 10s
const TESTER_QUEUE_REFRESH_MS = 15000; // 15s

export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: fetchUnitSummaries,
    refetchInterval: UNITS_REFRESH_MS,
  });
}

export function useUnitDetails(id: string) {
  return useQuery({
    queryKey: ["unit", id],
    queryFn: () => fetchUnitDetails(id),
    enabled: !!id,
  });
}

export function useSteps() {
  return useQuery({
    queryKey: ["steps"],
    queryFn: fetchSteps,
  });
}

export function useTesterQueue(testerId: string) {
  return useQuery({
    queryKey: ["testerQueue", testerId],
    queryFn: () => fetchTesterQueue(testerId),
    enabled: !!testerId,
    refetchInterval: TESTER_QUEUE_REFRESH_MS,
  });
}

export function useTesterAssignments(testerId: string) {
  return useQuery({
    queryKey: ["testerAssignments", testerId],
    queryFn: () => fetchTesterAssignments(testerId),
    enabled: !!testerId,
    refetchInterval: 10000, // auto-refresh
  });
}

export function useAssignmentsSchedule() {
  return useQuery({
    queryKey: ["assignmentsSchedule"],
    queryFn: fetchAssignmentsSchedule,
    refetchInterval: 10000,
  });
}

export function useTesters() {
  const role = getRole();
  return useQuery({
    queryKey: ["testers"],
    queryFn: fetchTesters,
    enabled: role === "supervisor",
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        tester_id?: string;
        status?: string;
        start_at?: string | null;
        end_at?: string | null;
      };
    }) => updateAssignment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignmentsSchedule"] });
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unit_id: string) => createUnit(unit_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

// Rename unit
export function useRenameUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { oldId: string; newId: string }) => {
      const { oldId, newId } = payload;
      return request(`/units/${encodeURIComponent(oldId)}/rename`, {
        method: "PATCH",
        body: JSON.stringify({ new_unit_id: newId }),
      });
    },
    onSuccess: () => {
      // refresh units list
      queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

export function useCreateResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createResult,
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["unit", variables.unit_id] });
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

// NEW: delete unit
export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unit_id: string) => deleteUnit(unit_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

// NEW: tester notifications (for "unit ready" alerts)
export function useTesterNotifications(testerId: string | null) {
  return useQuery<Notification[]>({
    queryKey: ["testerNotifications", testerId],
    queryFn: () => {
      if (!testerId) return Promise.resolve([]);
      return getTesterNotifications(testerId);
    },
    enabled: !!testerId,
    refetchInterval: 5000, // poll every 5s for new ready notifications
  });
}

export function useTesterSchedule(testerId: string) {
  return useQuery<Assignment[], Error>({
    queryKey: ["testerSchedule", testerId],
    enabled: !!testerId,
    queryFn: async () => {
      if (!testerId) return [];
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/tester/schedule?tester_id=${encodeURIComponent(testerId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
  });
}
