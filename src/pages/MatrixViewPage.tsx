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

function formatDateFromISO(value?: string | null): string {
  if (!value) return "-";
  return value.slice(0, 10); // "YYYY-MM-DD"
}

function cellBackground(status: string, passed?: boolean): string {
  if (status === "RESULT") {
    if (passed === true) return "#34d870ff";
    if (passed === false) return "#f08d8dff";
  }
  if (status === "RUNNING") return "#cef010ff";
  if (status === "OVERDUE") return "#d6b910ff"; // overdue color
  return "#e5e7eb";
}

function cellBorderColor(status: string, passed?: boolean): string {
  if (status === "RESULT") {
    if (passed === true) return "#16a34a";
    if (passed === false) return "#ef4444";
  }
  if (status === "RUNNING") return "#6b5838ff";
  if (status === "OVERDUE") return "#cc7000"; // overdue border
  return "#d1d5db";
}

/* ---------- reusable table renderer ---------- */

type CellStatusKind = "PENDING" | "RUNNING" | "RESULT" | "OVERDUE";

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
  compact?: boolean; // true in fullscreen
}) {
  const headerFontSize = compact ? 11 : 12;
  const cellFontSize = compact ? 10 : 11;

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        tableLayout: "fixed", // force all columns to fit, no horizontal scroll in fullscreen
      }}
    >
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
              minWidth: 70,
              fontSize: headerFontSize,
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
                whiteSpace: "normal",
                fontSize: headerFontSize,
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.order}.</span>{" "}
              <span>{s.name}</span>
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
                fontWeight: 600,
                fontSize: cellFontSize,
              }}
            >
              {row.unitId}
            </td>
            {steps.map((step) => {
              const cell = row.cells[step.id];

              const bg = cellBackground(cell.statusKind, cell.passed);
              const border = cellBorderColor(cell.statusKind, cell.passed);

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
                    }}
                  >
                    <div
                      style={{
                        fontSize: cellFontSize,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {cell.tester || "-"}
                    </div>
                    <div
                      style={{
                        fontSize: cellFontSize,
                        color: "#374151",
                        marginTop: 1,
                      }}
                    >
                      {cell.date || "-"}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: cellFontSize,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color:
                          cell.passed === true
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

  // Fullscreen + auto-paging
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState(0);

  // New: hide completed toggle
  const [hideCompleted, setHideCompleted] = useState(true);

  // fetch all unit details in one go for the matrix
  const unitIds = useMemo(
    () => (units ?? []).map((u) => u.unit_id),
    [units]
  );

  // unit_id -> status lookup (for filtering)
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

    // today's date in YYYY-MM-DD
    const todayKey = new Date().toISOString().slice(0, 10);

    const detailsByUnit = new Map<string, UnitDetails>();
    for (const d of detailsList) {
      detailsByUnit.set(d.unit.id, d);
    }

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
          const a = assignByStep.get(step.id) || null;
          const r = resultByStep.get(step.id) || null;
          const tester = a?.tester_id ?? null;

          let date: string | null = null;
          if (r?.finished_at) {
            // finished time takes priority
            date = formatDateFromISO(r.finished_at);
          } else if (a?.start_at) {
            date = formatDateFromISO(a.start_at as any);
          }

          let statusLabel = "PENDING";
          let statusKind: CellStatusKind = "PENDING";
          let passed: boolean | undefined;

          if (r) {
            // Result exists
            statusKind = "RESULT";
            passed = r.passed;
            statusLabel = r.passed ? "PASS" : "FAIL";
          } else if (a) {
            // No result yet – infer from assignment status + date
            if (a.status === "RUNNING") {
              statusKind = "RUNNING";
              statusLabel = "RUNNING";
            } else {
              // derive date key from start_at
              let startStr: string | null = null;
              if (typeof a.start_at === "string") {
                startStr = a.start_at.slice(0, 10);
              } else if (a.start_at instanceof Date) {
                startStr = a.start_at.toISOString().slice(0, 10);
              } else if (a.start_at) {
                try {
                  // @ts-ignore
                  startStr = new Date(a.start_at).toISOString().slice(0, 10);
                } catch {
                  startStr = null;
                }
              }

              if (startStr) {
                if (startStr < todayKey) {
                  // overdue
                  statusKind = "OVERDUE";
                  statusLabel = "OVERDUE";
                } else if (startStr === todayKey) {
                  // due today
                  statusKind = "RUNNING";
                  statusLabel = "RUNNING";
                } else {
                  // future
                  statusKind = "PENDING";
                  statusLabel = "PENDING";
                }
              } else {
                // unscheduled
                statusKind = "PENDING";
                statusLabel = "PENDING";
              }
            }
          }

          cells[step.id] = { tester, date, statusLabel, statusKind, passed };
        }
      } else {
        // no details yet -> everything pending
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

  // ===== NEW: filter out completed units when toggle is ON =====
  const filteredRows = useMemo(() => {
    if (rows.length === 0) return [];
    return rows.filter((row) => {
      const status = unitStatusMap[row.unitId]; // "COMPLETED" / "IN_PROGRESS" / etc.
      if (!status) return true;
      if (hideCompleted && status === "COMPLETED") return false;
      return true;
    });
  }, [rows, unitStatusMap, hideCompleted]);

  /* ----- paging for fullscreen mode ----- */

  const rowsPerPage = 12; // you can tweak this
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

  // auto-advance pages when fullscreen
  useEffect(() => {
    if (!isFullscreen || totalPages <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 15000); // change every 15s
    return () => clearInterval(id);
  }, [isFullscreen, totalPages]);

  // reset to first page when enter fullscreen or rows change
  useEffect(() => {
    if (isFullscreen) setPage(0);
  }, [isFullscreen, filteredRows.length]);

  /* ---------- render ---------- */

  const hasAnyRows = filteredRows.length > 0;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__title-group">
          <h1>Matrix View</h1>
          <p>
            Full-screen overview of all units vs all test steps. Cells show{" "}
            <strong>tester</strong>, <strong>date</strong> and{" "}
            <strong>result</strong>.
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
            <button
              className="btn btn-secondary"
              onClick={() => setIsFullscreen(true)}
            >
              Full screen
            </button>
          </div>
        )}
      </header>

      {anyLoading && <div>Loading matrix…</div>}
      {unitsError && (
        <div className="banner banner--error">
          Error loading units: {(unitsError as any).message}
        </div>
      )}
      {stepsError && (
        <div className="banner banner--error">
          Error loading steps: {(stepsError as any).message}
        </div>
      )}
      {detailsError && (
        <div className="banner banner--error">
          Error loading details: {(detailsError as any).message}
        </div>
      )}

      {!anyLoading && !hasAnyRows && (
        <p className="text-muted" style={{ marginTop: 8 }}>
          {hideCompleted
            ? "No active units to show (all completed or filtered)."
            : "No units to show yet."}
        </p>
      )}

      {hasAnyRows && stepsOrdered.length > 0 && (
        <section
          className="card"
          style={{
            marginTop: 8,
            padding: 8,
          }}
        >
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              overflowX: "auto",
            }}
          >
            {/* normal view: use filteredRows (respect hide-completed toggle) */}
            <MatrixTable
              rows={filteredRows}
              steps={stepsOrdered}
              compact={false}
            />
          </div>
        </section>
      )}

      {/* ---------- fullscreen overlay ---------- */}
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
                Full-screen mode. Pages auto-change every 15s if there are many
                units.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {totalPages > 1 && (
                <div style={{ fontSize: 12 }}>
                  Page <strong>{page + 1}</strong> / {totalPages}
                </div>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setIsFullscreen(false)}
              >
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
              overflow: "hidden", // no scrollbars; paging handles large sets
              height: "100%", 
            }}
          >
            <div
              style={{
                flex: 1,
                overflow: "hidden",
              }}
            >
              {/* fullscreen: compact table, forced to fit width, only subset of rows */}
              <MatrixTable
                rows={visibleRows}
                steps={stepsOrdered}
                compact={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

