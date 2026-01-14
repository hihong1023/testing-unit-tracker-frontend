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

// IMPORTANT: local YYYY-MM-DD (avoid UTC date shifting)
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

function cellBackground(kind: CellStatusKind, passed?: boolean): string {
  if (kind === "PASS") return "#34d870ff";
  if (kind === "FAIL") return "#f08d8dff";
  if (kind === "RUNNING") return "#cef010ff";
  if (kind === "OVERDUE") return "#d6b910ff";
  if (kind === "SKIPPED") return "#e5e7eb";
  return "#e5e7eb";
}

function cellBorderColor(kind: CellStatusKind, passed?: boolean): string {
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

/* ---------- reusable table renderer ---------- */
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

  // 🔒 fixed dimensions
  const headerH = compact ? 52 : 64;
  const unitColW = compact ? 80 : 90;
  const stepColW = compact ? 90 : 150;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100vw",
    
        /* 🔑 FIX: limit height so scrollbar is reachable */
        height: "calc(100vh - 200px)", 
        /* adjust 230px if your header height changes */
    
        overflowX: "auto",
        overflowY: "auto",
    
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: unitColW + steps.length * stepColW,
          borderCollapse: "separate",
          borderSpacing: 0,
          tableLayout: compact ? "fixed" : "auto",
        }}
      >
        {/* 🔒 fixed column widths */}
        <colgroup>
          <col style={{ width: unitColW }} />
          {steps.map((s) => (
            <col key={s.id} style={{ width: stepColW }} />
          ))}
        </colgroup>

        {/* ================= HEADER ================= */}
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                top: 0,
                left: 0,
                zIndex: 4,

                height: headerH,
                minHeight: headerH,
                maxHeight: headerH,

                background: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",

                padding: "6px 10px",
                fontSize: headerFontSize,
                fontWeight: 600,
                textAlign: "left",

                overflow: "hidden", // 🔒 CRITICAL
                whiteSpace: "nowrap",
              }}
            >
              Unit
            </th>

            {steps.map((s) => (
              <th
                key={s.id}
                title={`${s.order}. ${s.name}`}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 3,

                  height: headerH,
                  minHeight: headerH,
                  maxHeight: headerH,

                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",

                  padding: "6px 8px",
                  fontSize: headerFontSize,
                  fontWeight: 500,
                  textAlign: "left",

                  overflow: "hidden", // 🔒 NO vertical scroll
                }}
              >
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      lineHeight: 1.15,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: compact ? "nowrap" : "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{s.order}.</span>{" "}
                    <span>{s.name}</span>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* ================= BODY ================= */}
        <tbody>
          {rows.map((row) => (
            <tr key={row.unitId}>
              {/* Sticky Unit column */}
              <td
                title={row.unitId}
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 2,

                  background: "#f9fafb",
                  borderTop: "1px solid #e5e7eb",

                  padding: "6px 10px",
                  fontSize: cellFontSize,
                  fontWeight: 600,

                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
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
                      borderTop: "1px solid #e5e7eb",
                      padding: compact ? 3 : 5,
                      verticalAlign: "top",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${border}`,
                        background: bg,

                        padding: compact ? "3px 4px" : "4px 6px",
                        minHeight: compact ? 42 : 46, // ✅ smaller height
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",

                        overflow: "hidden",
                      }}
                    >
                      <div
                        title={displayTester(cell.tester) || "-"}
                        style={{
                          fontSize: cellFontSize,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {displayTester(cell.tester) || "-"}
                      </div>

                      <div
                        title={cell.date || "-"}
                        style={{
                          fontSize: cellFontSize,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {cell.date || "-"}
                      </div>

                      <div
                        style={{
                          fontSize: cellFontSize,
                          fontWeight: 700,
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
    </div>
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
      // (kept your style: sequential fetch)
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

    const todayKey = localYYYYMMDD(); // ✅ FIXED (local date)

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

          // date: scheduler overrides result
          let date: string | null = null;
          
          // try all common finished fields (because your Unit Detail shows "Finished (SGT)")
          const finishedAny =
            (r as any)?.finished_at_sgt ??
            (r as any)?.finished_sgt ??
            (r as any)?.finished_at ??
            (r as any)?.finishedAt;
          
          if (finishedAny) {
            date = toISODate(finishedAny);
          }
          
          if (!date && !skipped && a) {
            const schedISO = toISODate(a.end_at ?? a.start_at);
            if (schedISO) date = schedISO;
          }

          let statusLabel = "PENDING";
          let statusKind: CellStatusKind = "PENDING";
          let passed: boolean | undefined = undefined;

          if (!a) {
            // keep PENDING
          } else if (skipped) {
            statusKind = "SKIPPED";
            statusLabel = "N/A";
          } else {
            const raw = (a.status || "").toString().toUpperCase();

            if (raw === "PASS" || raw === "FAIL") {
              statusKind = raw as CellStatusKind;
              statusLabel = raw;
              passed = raw === "PASS";
            } else if (raw === "RUNNING") {
              statusKind = "RUNNING";
              statusLabel = "RUNNING";
            } else {
              // derive from dates
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

              // fallback for legacy data
              if ((raw !== "PASS" && raw !== "FAIL" && raw !== "RUNNING") && r) {
                statusKind = r.passed ? "PASS" : "FAIL";
                statusLabel = r.passed ? "PASS" : "FAIL";
                passed = !!r.passed;
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
    filteredRows.length === 0 ? 1 : Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));

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
        maxWidth: "none", // ✅ remove centered max-width layouts
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
          paddingLeft: 0, // ✅ reduce side gaps
          paddingRight: 0, // ✅ reduce side gaps
          margin: 0,
          width: "100%",
          maxWidth: "none",
          boxSizing: "border-box",
        }}
      >
        <div className="page-header__title-group">
          <h1>Matrix View</h1>
          <p>
            Full-screen overview of all units vs all test steps. Cells show{" "}
            <strong>tester</strong>, <strong>date</strong> and <strong>result</strong>. Skipped
            steps are marked as <strong>N/A</strong>.
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

      {/* ✅ NORMAL VIEW TABLE (added back) */}
      {!anyLoading && hasAnyRows && stepsOrdered.length > 0 && (
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: "none",
            padding: 0, // ✅ no side gap
            margin: 0,
            overflow: "auto",
            boxSizing: "border-box",
          }}
        >
          <MatrixTable rows={filteredRows} steps={stepsOrdered} />
        </div>
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









