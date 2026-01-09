// src/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, request } from "./api";
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
  getTesterNotifications,
  deleteUnit,
  fetchTesterGroups,
  setTesterAssignmentStatus,
} from "./api";
import type { Notification, TesterGroups } from "./api";

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
    queryKey: ["unit", id], // keep RAW id here (important for invalidateQueries)
    enabled: !!id,
    queryFn: () => {
      // ✅ Encode here so DA#532 becomes DA%23532 in the API call
      const safeId = encodeURIComponent(id);
      return fetchUnitDetails(safeId);
    },
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
    refetchInterval: 10000,
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

export function useTesterGroups() {
  const role = getRole();
  return useQuery<TesterGroups>({
    queryKey: ["testerGroups"],
    queryFn: fetchTesterGroups,
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

// delete unit
export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unit_id: string) => deleteUnit(unit_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

// tester notifications
export function useTesterNotifications(testerId: string | null) {
  return useQuery<Notification[]>({
    queryKey: ["testerNotifications", testerId],
    queryFn: () => {
      if (!testerId) return Promise.resolve([]);
      return getTesterNotifications(testerId);
    },
    enabled: !!testerId,
    refetchInterval: 5000,
  });
}

export function useTesterSchedule(testerId: string) {
  return useQuery<Assignment[], Error>({
    queryKey: ["testerSchedule", testerId],
    enabled: !!testerId,
    queryFn: async () => {
      if (!testerId) return [];
      const params = new URLSearchParams({ tester_id: testerId });
      return request(`/tester/schedule?${params.toString()}`);
    },
  });
}

export function useTesterSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      status,
    }: {
      assignmentId: string;
      status: "RUNNING" | "PENDING";
    }) => setTesterAssignmentStatus(assignmentId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["testerAssignments"] });
      qc.invalidateQueries({ queryKey: ["testerQueue"] });
      qc.invalidateQueries({ queryKey: ["testerSchedule"] });
      qc.invalidateQueries({ queryKey: ["assignmentsSchedule"] });
    },
  });
}
