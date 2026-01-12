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
  try {
    return typeof value === "string"
      ? value.slice(0, 10)
      : new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

type CellStatusKind =
  | "PENDING"
  | "RUNNING"
  | "PASS"
  | "FAIL"
  | "OVERDUE"
  | "SKIPPED";

function cellBackground(kind: CellStatusKind): string {
  switch (kind) {
    case "PASS":
      return "#bbf7d0";
    case "FAIL":
      return "#fecaca";
    case "RUNNING":
      return "#fef08a";
    case "OVERDUE":
      return "#fed7aa";
    case "SKIPPED":
      return "#e5e7eb";
    default:
      return "#f3f4f6";
  }
}

function cellBorderColor(kind: CellStatusKind): string {
  switch (kind) {
    case "PASS":
      return "#16a34a";
    case "FAIL":
      return "#dc2626";
    case "RUNNING":
      return "#ca8a04";
    case "OVERDUE":
      return "#c2410c";
    case "SKIPPED":
      return "#9ca3af";
    default:
      return "#d1d5db";
  }
}

function displayTester(tester?: string | null): string {
  if (!tester) return "-";
  return tester.startsWith("group:")
    ? tester.slice("group:".length)
    : tester;
}

/* ---------- Matrix Table ---------- */

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
      }
    >;
  }[];
  steps: TestStep[];
  compact?: boolean;
}) {
  const headerFont = compact ? 11 : 12;
  const cellFont = compact ? 10 : 11;

  return (
    <table
      style={{
        width: "100%",
        tableLayout: "fixed",
        borderCollapse: "separate",
        borderSpacing: 0,
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
              padding: 8,
              borderBottom: "1px solid #e5e7eb",
              fontSize: headerFont,
              minWidth: 80,
            }}
          >
            Unit
          </th>
          {steps.map((s) => (
            <th
              key={s.id}
              style={{
                padding: 8,
                borderBottom: "1px solid #e5e7eb",
                fontSize: headerFont,
              }}
            >
              {s.order}. {s.name}
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
                padding: 8,
                borderTop: "1px solid #e5e7eb",
                fontWeight: 600,
                fontSize: cellFont,
              }}
            >
              {row.unitId}
            </td>

            {steps.map((step) => {
              const cell = row.cells[step.id];
              return (
                <td
                  key={step.id}
                  style={{
                    padding: compact ? 4 : 6,
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${cellBorderColor(
                        cell.statusKind
                      )}`,
                      background: cellBackground(cell.statusKind),
                      padding: compact ? "3px 4px" : "4px 6px",
                      minHeight: compact ? 42 : 50,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      fontSize: cellFont,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {displayTester(cell.tester)}
                    </div>
                    <div>{cell.date || "-"}</div>
                    <div style={{ fontWeight: 700 }}>
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

/* ---------- Page ---------- */

export default function MatrixViewPage() {
  const { data: units } = useUnits();
  const { data: steps } = useSteps();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState(0);
  const [hideCompleted, setHideCompleted] = useState(true);

  const unitIds = useMemo(
    () => (units ?? []).map((u) => u.unit_id),
    [units]
  );

  const { data: detailsList } = useQuery({
    queryKey: ["matrixDetails", unitIds],
    enabled: unitIds.length > 0,
    queryFn: async () => {
      const list: UnitDetails[] = [];
      for (const id of unitIds) {
        list.push(await fetchUnitDetails(id));
      }
      return list;
    },
  });

  const stepsOrdered = useMemo(
    () => (steps ?? []).slice().sort((a, b) => a.order - b.order),
    [steps]
  );

  const rows = useMemo(() => {
    if (!units || !detailsList) return [];
    const today = new Date().toISOString().slice(0, 10);

    const map = new Map(detailsList.map((d) => [d.unit.id, d]));

    return units
      .filter((u) => !(hideCompleted && u.status === "COMPLETED"))
      .map((u) => {
        const d = map.get(u.unit_id);
        const cells: any = {};

        for (const step of stepsOrdered) {
          const a = d?.assignments.find((x) => x.step_id === step.id);
          const r = d?.results.find((x) => x.step_id === step.id);

          let status: CellStatusKind = "PENDING";
          let label = "PENDING";

          if (a?.skipped) {
            status = "SKIPPED";
            label = "N/A";
          } else if (a?.status === "PASS" || a?.status === "FAIL") {
            status = a.status;
            label = a.status;
          } else if (a?.start_at) {
            const start = a.start_at.slice(0, 10);
            if (start < today) {
              status = "OVERDUE";
              label = "OVERDUE";
            } else if (start === today) {
              status = "RUNNING";
              label = "RUNNING";
            }
          }

          cells[step.id] = {
            tester: a?.tester_id ?? null,
            date: toISODate(a?.end_at ?? a?.start_at ?? r?.finished_at),
            statusKind: status,
            statusLabel: label,
          };
        }

        return { unitId: u.unit_id, cells };
      });
  }, [units, detailsList, stepsOrdered, hideCompleted]);

  /* ---------- paging ---------- */

  const rowsPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const visibleRows = isFullscreen
    ? rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
    : rows;

  useEffect(() => {
    if (!isFullscreen || totalPages <= 1) return;
    const id = setInterval(
      () => setPage((p) => (p + 1) % totalPages),
      15000
    );
    return () => clearInterval(id);
  }, [isFullscreen, totalPages]);

  /* ---------- render ---------- */

  return (
    <div
      className="page"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: "100%",
        padding: 0,
        overflow: "hidden", // ⭐ FIX
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
          padding: "12px 16px",
        }}
      >
        <h1>Matrix View</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setHideCompleted((v) => !v)}>
            {hideCompleted ? "Show completed" : "Hide completed"}
          </button>
          <button onClick={() => setIsFullscreen(true)}>
            Full screen
          </button>
        </div>
      </header>

      {/* ⭐ FIX: matrix fills remaining height */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: "auto", // ⭐ FIX: vertical + horizontal scroll
            background: "#ffffff",
          }}
        >
          <MatrixTable rows={visibleRows} steps={stepsOrdered} />
        </div>
      </section>

      {/* ---------- fullscreen ---------- */}
      {isFullscreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#020617",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            padding: 12,
          }}
        >
          <div style={{ color: "#e5e7eb", marginBottom: 8 }}>
            Page {page + 1} / {totalPages}
            <button
              style={{ marginLeft: 12 }}
              onClick={() => setIsFullscreen(false)}
            >
              Exit
            </button>
          </div>

          <div style={{ flex: 1, overflow: "hidden", background: "#fff" }}>
            <MatrixTable
              rows={visibleRows}
              steps={stepsOrdered}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}
