// src/pages/TesterQueuePage.tsx
import React, { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRole, getUser, createResult } from "../api";
import {
  useTesterAssignments,
  useUnits,
  useSteps,
  useTesterSetStatus,          // 👈 NEW
} from "../hooks";
import type { Assignment, TestStep, UnitSummary } from "../api";
import { usePrompt } from "../components/PromptProvider";

/* ----------------- Helpers ----------------- */

function toDateKey(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10); // "YYYY-MM-DD"
}

function formatDateShort(value?: string | null): string {
  if (!value) return "-";
  if (value.length >= 10) return value.slice(0, 10);
  return value;
}

/* --------------- Main entry ---------------- */

export default function TesterQueuePage() {
  const role = getRole();

  if (role === "tester") {
    return <TesterQueueTesterView />;
  }

  if (role === "supervisor") {
    return <TesterQueueSupervisorView />;
  }

  return (
    <div>
      <h2>Today&apos;s Queue</h2>
      <p style={{ color: "#666", fontSize: 14 }}>
        Please log in as a tester or supervisor to view the queue.
      </p>
    </div>
  );
}

/* --------------- Tester view ---------------- */

interface UnitCard {
  unit_id: string;
  assignment: Assignment;
  step: TestStep | undefined;
}

function TesterQueueTesterView() {
  const prompt = usePrompt();
  const user = getUser();
  const testerId = user?.name ?? "";

  const {
    data: assignments,
    isLoading,
    error,
  } = useTesterAssignments(testerId);

  const { data: steps } = useSteps();
  const qc = useQueryClient();

  const stepById = useMemo(() => {
    const m = new Map<number, TestStep>();
    steps?.forEach((s) => m.set(s.id, s));
    return m;
  }, [steps]);

  const resultMutation = useMutation({
    mutationFn: createResult,
    onSuccess: (_data, variables: any) => {
      qc.invalidateQueries({ queryKey: ["unit", variables.unit_id] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["testerAssignments", testerId] });
    },
  });

  const statusMutation = useTesterSetStatus();   // 👈 NEW

  if (!testerId) {
    return (
      <div>
        <h2>Today&apos;s Queue (Tester)</h2>
        <p style={{ color: "#b91c1c", fontSize: 14 }}>
          No tester name found. Please log out and log in again as a tester.
        </p>
      </div>
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const unitCards: UnitCard[] = useMemo(() => {
    if (!assignments) return [];

    // Only include non-skipped assignments that are PENDING or RUNNING
    const base = assignments.filter(
      (a) => !a.skipped && (a.status === "PENDING" || a.status === "RUNNING")
    );

    const todayList = base;
    const byUnit = new Map<string, Assignment[]>();
    for (const a of todayList) {
      if (!byUnit.has(a.unit_id)) byUnit.set(a.unit_id, []);
      byUnit.get(a.unit_id)!.push(a);
    }

    const cards: UnitCard[] = [];
    for (const [unit_id, list] of byUnit.entries()) {
      let chosen: Assignment | null = null;

      const running = list.find((a) => a.status === "RUNNING");
      if (running) {
        chosen = running;
      } else {
        chosen = list
          .slice()
          .sort((a, b) => {
            const oa = stepById.get(a.step_id)?.order ?? a.step_id;
            const ob = stepById.get(b.step_id)?.order ?? b.step_id;
            return oa - ob;
          })[0];
      }

      if (chosen) {
        cards.push({
          unit_id,
          assignment: chosen,
          step: stepById.get(chosen.step_id),
        });
      }
    }

    cards.sort((a, b) => a.unit_id.localeCompare(b.unit_id));
    return cards;
  }, [assignments, stepById, todayKey]);

  const handleQuickResult = async (card: UnitCard, passed: boolean) => {
    if (resultMutation.isLoading) return;

    const ok = await prompt.confirm(
      `Mark ${card.unit_id} – ${
        card.step?.name ?? `Step ${card.assignment.step_id}`
      } as ${passed ? "PASS" : "FAIL"}?`,
      "Submit Result",
      { confirmText: passed ? "PASS" : "FAIL", cancelText: "Cancel" }
    );

    if (!ok) return;

    resultMutation.mutate({
      unit_id: card.unit_id,
      step_id: card.assignment.step_id,
      metrics: {},
      passed,
    });
  };

  const handleStartRunning = async (card: UnitCard) => {   // 👈 NEW
    if (statusMutation.isLoading) return;

    const ok = await prompt.confirm(
      `Start test for ${card.unit_id} – ${
        card.step?.name ?? `Step ${card.assignment.step_id}`
      }?`,
      "Mark as RUNNING",
      { confirmText: "Start", cancelText: "Cancel" }
    );
    if (!ok) return;

    statusMutation.mutate({
      assignmentId: card.assignment.id,
      status: "RUNNING",
    });
  };

  return (
    <div>
      <h2>Today&apos;s Queue (Tester)</h2>
      <p style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
        Logged in as <strong>{testerId}</strong>.
      </p>

      {isLoading && <div>Loading your scheduled tests…</div>}
      {error && (
        <div style={{ color: "red", fontSize: 13 }}>
          Error loading assignments: {(error as any).message}
        </div>
      )}

      {!isLoading && unitCards.length === 0 && (
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: "0.5rem" }}>
          No units ready for you right now.
        </div>
      )}

      {/* KDS-style card grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginTop: "0.75rem",
        }}
      >
        {unitCards.map((card) => {
          const a = card.assignment;
          const stepName =
            card.step?.name ?? `Step ${card.assignment.step_id}`;
          const start = formatDateShort(a.start_at);
          const end = formatDateShort(a.end_at);

          const startKey = toDateKey(a.start_at);
          const endKey = toDateKey(a.end_at);

          let visualStatus = a.status;

          if (a.status === "PENDING") {
            // Overdue: end date in the past
            if (endKey && endKey < todayKey) {
              visualStatus = "OVERDUE";
            }
            // Today window: still show PENDING until tester clicks RUNNING
          }

          let statusColor = "#e5e7eb";
          let statusTextColor = "#374151";

          if (visualStatus === "RUNNING") {
            statusColor = "#dcfce7";
            statusTextColor = "#166534";
          } else if (visualStatus === "OVERDUE") {
            statusColor = "#fee2e2";
            statusTextColor = "#b91c1c";
          } else if (visualStatus === "PENDING") {
            statusColor = "#fef9c3";
            statusTextColor = "#854d0e";
          }

          return (
            <div
              key={`${card.unit_id}-${a.step_id}`}
              style={{
                width: 260,
                minHeight: 160,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                padding: "0.6rem 0.75rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Top: unit + status */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {card.unit_id}
                </div>
                <span
                  style={{
                    padding: "0.1rem 0.5rem",
                    borderRadius: 999,
                    background: statusColor,
                    color: statusTextColor,
                    fontSize: 11,
                    fontWeight: 600,
                    alignSelf: "flex-start",
                  }}
                >
                  {visualStatus}
                </span>
              </div>

              {/* Middle: test + schedule */}
              <div style={{ marginTop: 4, fontSize: 13 }}>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "#6b7280",
                  }}
                >
                  Test
                </div>
                <div style={{ fontWeight: 600 }}>{stepName}</div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "#6b7280",
                  }}
                >
                  Scheduled
                </div>
                <div>
                  {start === "-" && end === "-"
                    ? "Not scheduled"
                    : `${start} → ${end}`}
                </div>
              </div>

              {/* Bottom: quick actions */}
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                {/* RUNNING button – only for PENDING assignments */}
                {a.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => handleStartRunning(card)}
                    disabled={statusMutation.isLoading}
                    style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: 999,
                      border: "1px solid #facc15",
                      background: "#fef9c3",
                      color: "#854d0e",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    MARK AS RUNNING
                  </button>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.4rem",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleQuickResult(card, true)}
                    disabled={resultMutation.isLoading}
                    style={{
                      flex: 1,
                      padding: "0.25rem 0.5rem",
                      borderRadius: 999,
                      border: "1px solid #22c55e",
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    PASS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickResult(card, false)}
                    disabled={resultMutation.isLoading}
                    style={{
                      flex: 1,
                      padding: "0.25rem 0.5rem",
                      borderRadius: 999,
                      border: "1px solid #f97373",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    FAIL
                  </button>
                </div>
              </div>

              {(resultMutation.isLoading || statusMutation.isLoading) && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: "#6b7280",
                    textAlign: "right",
                  }}
                >
                  Updating…
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------- Supervisor view ------------- */

function TesterQueueSupervisorView() {
  const { data: units, isLoading, error } = useUnits();

  const sortedUnits: UnitSummary[] = useMemo(
    () =>
      (units ?? [])
        .slice()
        .sort((a, b) => a.unit_id.localeCompare(b.unit_id)),
    [units]
  );

  return (
    <div>
      <h2>Unit Progress (Supervisor)</h2>
      <p style={{ fontSize: 14, color: "#4b5563" }}>
        Overview of each unit&apos;s progress and next step.
      </p>

      {isLoading && <div>Loading units…</div>}
      {error && (
        <div style={{ color: "red", fontSize: 13 }}>
          Error loading units: {(error as any).message}
        </div>
      )}

      {!isLoading && sortedUnits.length === 0 && (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          No units created yet.
        </div>
      )}

      {sortedUnits.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            marginTop: "0.5rem",
          }}
        >
          <thead>
            <tr>
              <th align="left">Unit</th>
              <th align="left">Status</th>
              <th align="left">Progress</th>
              <th align="left">Next step</th>
            </tr>
          </thead>
          <tbody>
            {sortedUnits.map((u) => (
              <tr key={u.unit_id}>
                <td>{u.unit_id}</td>
                <td>{u.status}</td>
                <td>{u.progress_percent.toFixed(1)}%</td>
                <td>{u.next_step_name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
