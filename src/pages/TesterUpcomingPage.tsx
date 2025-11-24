// src/pages/TesterUpcomingPage.tsx
import React, { useMemo, useState } from "react";
import { getUser } from "../api";
import { useTesterAssignments, useSteps } from "../hooks";
import type { Assignment } from "../api";

export default function TesterUpcomingPage() {
  const user = getUser();
  const testerId = user?.name ?? "";

  const {
    data: assignments,
    isLoading,
    error,
  } = useTesterAssignments(testerId);

  const { data: steps } = useSteps();

  const stepNameById = useMemo(() => {
    const m = new Map<number, string>();
    steps?.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [steps]);

  const todayKey = new Date().toISOString().slice(0, 10);

  const upcomingGroups: {
    dateKey: string;
    assignments: Assignment[];
    unitCount: number;
  }[] = useMemo(() => {
    const base: Assignment[] = assignments ?? [];
    const map: Record<string, Assignment[]> = {};

    base.forEach((a) => {
      const dk = toDateKey(a.start_at);
      if (!dk) return;
      if (dk <= todayKey) return; // only future dates
      if (!map[dk]) map[dk] = [];
      map[dk].push(a);
    });

    return Object.entries(map)
      .sort(([d1], [d2]) => d1.localeCompare(d2))
      .map(([dateKey, list]) => {
        const units = new Set<string>();
        list.forEach((a) => units.add(a.unit_id));
        return { dateKey, assignments: list, unitCount: units.size };
      });
  }, [assignments, todayKey]);

  const [openDate, setOpenDate] = useState<string | null>(null);

  if (!testerId) {
    return (
      <div className="page">
        <header className="page-header">
          <div className="page-header__title-group">
            <h1>Upcoming Tests (Tester)</h1>
            <p className="text-error">
              No tester name found. Please log out and log in again as a tester.
            </p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__title-group">
          <h1>Upcoming Tests (Tester)</h1>
          <p>
            Logged in as <strong>{testerId}</strong>. Only tests{" "}
            <strong>assigned to you</strong> and scheduled after today are
            listed here.
          </p>
        </div>

        {assignments && (
          <div className="status-pill">
            <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
              Upcoming tests
            </span>
            <strong>
              {upcomingGroups.reduce(
                (sum, g) => sum + g.assignments.length,
                0
              )}
            </strong>
          </div>
        )}
      </header>

      <section className="card queue-card">
        <div className="card__header">
          <div>
            <div className="card__title">Future schedule</div>
            <div className="card__subtitle">
              Dates are grouped by planned start date. Click a row to see unit
              and step details.
            </div>
          </div>
        </div>

        {isLoading && <p className="text-muted">Loading upcoming tests…</p>}

        {error && (
          <p className="text-error">
            Error loading assignments: {(error as any).message}
          </p>
        )}

        {!isLoading && !error && upcomingGroups.length === 0 && (
          <p className="text-muted">
            No upcoming scheduled tests. Everything assigned to you is either
            for today or earlier.
          </p>
        )}

        {!isLoading && !error && upcomingGroups.length > 0 && (
          <div className="queue-upcoming-list">
            {upcomingGroups.map((g) => {
              const open = openDate === g.dateKey;
              return (
                <React.Fragment key={g.dateKey}>
                  {/* Date summary row */}
                  <div
                    className={
                      "queue-summary-row queue-summary-row--upcoming" +
                      (open ? " queue-summary-row--open" : "")
                    }
                    role="button"
                    onClick={() =>
                      setOpenDate((prev) =>
                        prev === g.dateKey ? null : g.dateKey
                      )
                    }
                  >
                    <div className="queue-summary-main">
                      <div className="queue-summary-title">{g.dateKey}</div>
                      <div className="queue-summary-subtitle">
                        {g.unitCount} unit{g.unitCount !== 1 ? "s" : ""},{" "}
                        {g.assignments.length} test
                        {g.assignments.length !== 1 ? "s" : ""} assigned to you
                      </div>
                    </div>
                    <div className="queue-summary-arrow">
                      {open ? "▴" : "▾"}
                    </div>
                  </div>

                  {/* Details table under this date */}
                  {open && (
                    <div className="queue-table-wrapper queue-table-wrapper--nested">
                      <div className="queue-detail-title">
                        Details for {g.dateKey}
                      </div>
                      <table className="queue-table">
                        <thead>
                          <tr>
                            <th align="left">Unit</th>
                            <th align="left">Step</th>
                            <th align="left">Status</th>
                            <th align="left">Start</th>
                            <th align="left">End</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.assignments.map((a) => (
                            <tr key={a.id}>
                              <td>{a.unit_id}</td>
                              <td>
                                {stepNameById.get(a.step_id) ??
                                  `Step ${a.step_id}`}
                              </td>
                              <td>{a.status}</td>
                              <td>{formatDateShort(a.start_at)}</td>
                              <td>{formatDateShort(a.end_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* Helpers */

function toDateKey(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function formatDateShort(value?: string | null): string {
  if (!value) return "";
  if (value.length === 10) return value;
  return value.slice(0, 10);
}
