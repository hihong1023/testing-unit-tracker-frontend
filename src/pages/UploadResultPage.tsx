// src/pages/MatrixViewPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUnits, useSteps } from "../hooks";
import {
  fetchUnitDetails,
  type UnitSummary,
  type TestStep,
  type UnitDetails,
} from "../api";

/* ---------- helpers ---------- */

function toISODate(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function localYYYYMMDD(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type CellStatusKind =
  | "PENDING"
  | "RUNNING"
  | "PASS"
  | "FAIL"
  | "OVERDUE"
  | "SKIPPED";

function cellBackground(kind: CellStatusKind): string {
  if (kind === "PASS") return "#34d870ff";
  if (kind === "FAIL") return "#f08d8dff";
  if (kind === "RUNNING") return "#cef010ff";
  if (kind === "OVERDUE") return "#d6b910ff";
  if (kind === "SKIPPED") return "#e5e7eb";
  return "#e5e7eb";
}

function cellBorderColor(kind: CellStatusKind): string {
  if (kind === "PASS") return "#16a34a";
  if (kind === "FAIL") return "#ef4444";
  if (kind === "RUNNING") return "#6b5838ff";
  if (kind === "OVERDUE") return "#cc7000";
  if (kind === "SKIPPED") return "#d1d5db";
  return "#d1d5db";
}

function displayTester(tester?: string | null): string {
  if (!tester) return "";
  if (tester.startsWith("group:")) return tester.slice("group:".length);
  return tester;
}

/* ---------- reusable table renderer (NO OVERLAP) ---------- */

function MatrixTable({
  rows,
  steps,
  compact,
}: {
  rows: {
    unitId: string;
    cells: Record<
      number,
      {
        tester: string | null;
        date: string | null;
        statusLabel: string;
        statusKind: CellStatusKind;
        passed?: boolean;
      }
    >;
  }[];
  steps: TestStep[];
  compact?: boolean;
}) {
  const headerFontSize = compact ? 10 : 12;
  const cellFontSize = compact ? 10 : 11;

  const unitColW = compact ? 80 : 90;
  const stepColW = compact ? 78 : 150;

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        tableLayout: compact ? "fixed" : "auto",
        minWidth: unitColW + steps.length * stepColW,
      }}
    >
      <colgroup>
        <col style={{ width: unitColW }} />
        {steps.map((s) => (
          <col key={s.id} style={{ width: stepColW }} />
        ))}
      </colgroup>

      <thead>
        <tr>
          <th
            style={{
              position: "sticky",
              left: 0,
              zIndex: 2,
              background: "#f9fafb",
              padding: "8px 12px",
              textAlign: "left",
              borderBottom: "1px solid #e5e7eb",
              fontSize: headerFontSize,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Unit
          </th>

          {steps.map((s) => (
            <th
              key={s.id}
              style={{
                padding: "8px 8px",
                textAlign: "left",
                borderBottom: "1px solid #e5e7eb",
                fontSize: headerFontSize,
                verticalAlign: "bottom",
              }}
              title={`${s.order}. ${s.name}`}
            >
              <div
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: compact ? "nowrap" : "normal",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  lineHeight: 1.15,
                }}
              >
                <span style={{ fontWeight: 700 }}>{s.order}.</span>{" "}
                <span>{s.name}</span>
              </div>
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <tr key={row.unitId}>
            <td
              style={{
                position: "sticky",
                left: 0,
                zIndex: 1,
                background: "#f9fafb",
                padding: "8px 12px",
                borderTop: "1px solid #e5e7eb",
                fontWeight: 700,
                fontSize: cellFontSize,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={row.unitId}
            >
              {row.unitId}
            </td>

            {steps.map((step) => {
              const cell = row.cells[step.id];
              const bg = cellBackground(cell.statusKind);
              const border = cellBorderColor(cell.statusKind);

              return (
                <td
                  key={step.id}
                  style={{
                    padding: compact ? 4 : 6,
                    borderTop: "1px solid #e5e7eb",
                    verticalAlign: "top",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${border}`,
                      background: bg,
                      padding: compact ? "3px 4px" : "4px 6px",
                      minHeight: compact ? 44 : 52,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        fontSize: cellFontSize,
                        fontWeight: 700,
                        color: "#111827",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={displayTester(cell.tester) || "-"}
                    >
                      {displayTester(cell.tester) || "-"}
                    </div>

                    <div
                      style={{
                        fontSize: cellFontSize,
                        color: "#374151",
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={cell.date || "-"}
                    >
                      {cell.date || "-"}
                    </div>

                    <div
                      style={{
                        marginTop: 2,
                        fontSize: cellFontSize,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        color:
                          cell.statusKind === "SKIPPED"
                            ? "#6b7280"
                            : cell.passed === true
                            ? "#166534"
                            : cell.passed === false
                            ? "#b91c1c"
                            : cell.statusKind === "RUNNING"
                            ? "#854d0e"
                            : cell.statusKind === "OVERDUE"
                            ? "#92400e"
                            : "#4b5563",
                      }}
                    >
                      {cell.statusLabel}
                    </div>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- main page ---------- */

export default function MatrixViewPage() {
  const { data: units, isLoading: unitsLoading, error: unitsError } = useUnits();
  const { data: steps, isLoading: stepsLoading, error: stepsError } = useSteps();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState(0);
  const [hideCompleted, setHideCompleted] = useState(true);

  const unitIds = useMemo(() => (units ?? []).map((u) => u.unit_id), [units]);

  const unitStatusMap = useMemo(() => {
    const m: Record<string, string> = {};
    (units ?? []).forEach((u) => {
      m[u.unit_id] = u.status;
    });
    return m;
  }, [units]);

  const {
    data: detailsList,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuery({
    queryKey: ["matrixDetails", unitIds],
    enabled: unitIds.length > 0,
    queryFn: async (): Promise<UnitDetails[]> => {
      const list: UnitDetails[] = [];
      for (const id of unitIds) {
        const d = await fetchUnitDetails(id);
        list.push(d);
      }
      return list;
    },
  });

  const stepsOrdered: TestStep[] = useMemo(
    () => (steps ?? []).slice().sort((a, b) => a.order - b.order),
    [steps]
  );

  const rows = useMemo(() => {
    if (!units || !detailsList || stepsOrdered.length === 0) return [];

    const todayKey = localYYYYMMDD();

    const detailsByUnit = new Map<string, UnitDetails>();
    for (const d of detailsList) detailsByUnit.set(d.unit.id, d);

    return units.map((u: UnitSummary) => {
      const d = detailsByUnit.get(u.unit_id);

      const cells: Record<
        number,
        {
          tester: string | null;
          date: string | null;
          statusLabel: string;
          statusKind: CellStatusKind;
          passed?: boolean;
        }
      > = {};

      if (d) {
        const assignByStep = new Map<number, UnitDetails["assignments"][number]>();
        for (const a of d.assignments) assignByStep.set(a.step_id, a);

        const resultByStep = new Map<number, UnitDetails["results"][number]>();
        for (const r of d.results) resultByStep.set(r.step_id, r);

        for (const step of stepsOrdered) {
          const a = (assignByStep.get(step.id) as any) || null;
          const r = resultByStep.get(step.id) || null;

          const tester = a?.tester_id ?? null;
          const skipped = !!a?.skipped;

          // ✅ DATE PRIORITY (YOUR REQUEST):
          // 1) Result finished_at (upload-set date)
          // 2) Schedule end_at/start_at
          let date: string | null = null;

          if (r?.finished_at) {
            date = toISODate(r.finished_at);
          }
          if (!date && !skipped && a) {
            const schedISO = toISODate(a.end_at ?? a.start_at);
            if (schedISO) date = schedISO;
          }

          let statusLabel = "PENDING";
          let statusKind: CellStatusKind = "PENDING";
          let passed: boolean | undefined = undefined;

          if (!a) {
            // no assignment => pending
          } else if (skipped) {
            statusKind = "SKIPPED";
            statusLabel = "N/A";
          } else {
            const raw = (a.status || "").toString().toUpperCase();

            // explicit assignment result wins
            if (raw === "PASS" || raw === "FAIL") {
              statusKind = raw as CellStatusKind;
              statusLabel = raw;
              passed = raw === "PASS";
            }
            // if assignment isn't final, but result exists -> show result
            else if (r) {
              statusKind = r.passed ? "PASS" : "FAIL";
              statusLabel = r.passed ? "PASS" : "FAIL";
              passed = !!r.passed;
            }
            // running / overdue / pending derived from schedule
            else if (raw === "RUNNING") {
              statusKind = "RUNNING";
              statusLabel = "RUNNING";
            } else {
              let startStr: string | null = null;

              if (typeof a.start_at === "string") startStr = a.start_at.slice(0, 10);
              else if (a.start_at instanceof Date) startStr = localYYYYMMDD(a.start_at);
              else if (a.start_at) {
                try {
                  startStr = localYYYYMMDD(new Date(a.start_at));
                } catch {
                  startStr = null;
                }
              }

              if (startStr) {
                if (startStr < todayKey) {
                  statusKind = "OVERDUE";
                  statusLabel = "OVERDUE";
                } else if (startStr === todayKey) {
                  statusKind = "RUNNING";
                  statusLabel = "RUNNING";
                } else {
                  statusKind = "PENDING";
                  statusLabel = "PENDING";
                }
              } else {
                statusKind = "PENDING";
                statusLabel = "PENDING";
              }
            }
          }

          cells[step.id] = { tester, date, statusLabel, statusKind, passed };
        }
      } else {
        for (const step of stepsOrdered) {
          cells[step.id] = {
            tester: null,
            date: null,
            statusLabel: "PENDING",
            statusKind: "PENDING",
          };
        }
      }

      return { unitId: u.unit_id, cells };
    });
  }, [units, detailsList, stepsOrdered]);

  const anyLoading = unitsLoading || stepsLoading || detailsLoading;

  const filteredRows = useMemo(() => {
    if (rows.length === 0) return [];
    return rows.filter((row) => {
      const status = unitStatusMap[row.unitId];
      if (!status) return true;
      if (hideCompleted && status === "COMPLETED") return false;
      return true;
    });
  }, [rows, unitStatusMap, hideCompleted]);

  const rowsPerPage = 12;
  const totalPages =
    filteredRows.length === 0
      ? 1
      : Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));

  const visibleRows = useMemo(() => {
    if (!isFullscreen) return filteredRows;
    if (filteredRows.length === 0) return filteredRows;
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, isFullscreen, page]);

  useEffect(() => {
    if (!isFullscreen || totalPages <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 15000);
    return () => clearInterval(id);
  }, [isFullscreen, totalPages]);

  useEffect(() => {
    if (isFullscreen) setPage(0);
  }, [isFullscreen, filteredRows.length]);

  const hasAnyRows = filteredRows.length > 0;

  return (
    <div
      className="page"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        padding: 0,
        margin: 0,
        width: "100%",
        maxWidth: "none",
        boxSizing: "border-box",
      }}
    >
      <header
        className="page-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div className="page-header__title-group">
          <h1>Matrix View</h1>
          <p>
            Full-screen overview of all units vs all test steps. Cells show{" "}
            <strong>tester</strong>, <strong>date</strong> and <strong>result</strong>.
            Skipped steps are marked as <strong>N/A</strong>.
          </p>
        </div>

        {rows.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setHideCompleted((v) => !v)}
            >
              {hideCompleted ? "Show completed units" : "Hide completed units"}
            </button>
            <button className="btn btn-secondary" onClick={() => setIsFullscreen(true)}>
              Full screen
            </button>
          </div>
        )}
      </header>

      {anyLoading && <div style={{ padding: 12 }}>Loading matrix…</div>}

      {unitsError && (
        <div className="banner banner--error" style={{ margin: 12 }}>
          Error loading units: {(unitsError as any).message}
        </div>
      )}
      {stepsError && (
        <div className="banner banner--error" style={{ margin: 12 }}>
          Error loading steps: {(stepsError as any).message}
        </div>
      )}
      {detailsError && (
        <div className="banner banner--error" style={{ margin: 12 }}>
          Error loading details: {(detailsError as any).message}
        </div>
      )}

      {!anyLoading && !hasAnyRows && (
        <p className="text-muted" style={{ margin: 12 }}>
          {hideCompleted
            ? "No active units to show (all completed or filtered)."
            : "No units to show yet."}
        </p>
      )}

      {/* NORMAL VIEW: allow horizontal scroll to prevent header overlap */}
      {!anyLoading && hasAnyRows && stepsOrdered.length > 0 && (
        <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", width: "100%" }}>
          <MatrixTable rows={filteredRows} steps={stepsOrdered} />
        </div>
      )}

      {/* FULLSCREEN OVERLAY */}
      {isFullscreen && hasAnyRows && stepsOrdered.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "#00008B",
            display: "flex",
            flexDirection: "column",
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#e5e7eb",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Matrix View</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Full-screen mode. Pages auto-change every 15s if there are many units.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {totalPages > 1 && (
                <div style={{ fontSize: 12 }}>
                  Page <strong>{page + 1}</strong> / {totalPages}
                </div>
              )}
              <button className="btn btn-secondary" onClick={() => setIsFullscreen(false)}>
                Exit full screen
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: 12,
              background: "#ffffff",
              padding: 8,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              height: "100%",
            }}
          >
            <div style={{ flex: 1, overflow: "hidden" }}>
              <MatrixTable rows={visibleRows} steps={stepsOrdered} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
