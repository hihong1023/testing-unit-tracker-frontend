// src/pages/SchedulerPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  useAssignmentsSchedule,
  useSteps,
  useTesters,
  useUpdateAssignment,
  useTesterGroups,
} from "../hooks";
import type { Assignment, TestStep } from "../api";
import { usePrompt } from "../components/PromptProvider";


/* =========================================================
   Types
   ========================================================= */
interface RowState {
  tester_id: string;
  start_date: string;
  end_date: string;
  status: string;
  dirty?: boolean;
}

type DuplicateModalProps = {
  source: string | null;
  duplicateUnitIdsText: string;
  setDuplicateUnitIdsText: (v: string) => void;
  duplicateShiftDays: number;
  setDuplicateShiftDays: (n: number) => void;
  onClose: () => void;
  onConfirm: (
    sourceUnit: string,
    newUnitIds: string[],
    shiftDays: number
  ) => Promise<void>;
};

/* =========================================================
   Helpers  (unchanged)
   ========================================================= */
function isoDateFromBackend(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* =========================================================
   ✅ Duplicate Modal (MOVED OUTSIDE SchedulerPage)
   This prevents remounting & focus loss while typing.
   ========================================================= */
function DuplicateModal({
  source,
  duplicateUnitIdsText,
  setDuplicateUnitIdsText,
  duplicateShiftDays,
  setDuplicateShiftDays,
  onClose,
  onConfirm,
}: DuplicateModalProps) {
  const prompt = usePrompt();
  const parsedNewUnits = duplicateUnitIdsText
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Duplicate Schedule</h2>

        {/* aligned 3-input row */}
        <div className="dup-row">
          <div className="dup-field">
            <label className="dup-label">Source Unit:</label>
            <input className="dup-input" value={source || ""} disabled />
          </div>

          <div className="dup-field">
            <label className="dup-label">
              New Unit IDs (comma / space / newline separated):
            </label>
            <textarea
              className="dup-input dup-textarea"
              rows={1}
              value={duplicateUnitIdsText}
              onChange={(e) => setDuplicateUnitIdsText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="dup-field">
            <label className="dup-label">Shift by Days:</label>
            <input
              className="dup-input"
              type="number"
              value={duplicateShiftDays}
              onChange={(e) =>
                setDuplicateShiftDays(parseInt(e.target.value || "0", 10))
              }
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            className="btn btn-primary"
            disabled={!source || parsedNewUnits.length === 0}
            onClick={async () => {
              if (!source) {
                await prompt.alert(
                  "Please click a unit card first.",
                  "Duplicate Schedule"
                );
                return;
              }

              try {
                await onConfirm(source, parsedNewUnits, duplicateShiftDays);

                await prompt.alert(
                  `Schedule duplicated to: ${parsedNewUnits.join(", ")}`,
                  "Success"
                );

                onClose();
              } catch (err: any) {
                await prompt.alert(
                  err.message || String(err),
                  "Duplicate Failed"
                );
              }
            }}
          >
            Confirm
          </button>

          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Main Page
   ========================================================= */
export default function SchedulerPage() {
  const { data: assignments, isLoading, error } = useAssignmentsSchedule();
  const { data: steps } = useSteps();
  const { data: testers } = useTesters();
  const { data: testerGroups } = useTesterGroups();
  const updateAssignment = useUpdateAssignment();
  const prompt = usePrompt();

  const [editState, setEditState] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ Duplicate schedule modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateUnitIdsText, setDuplicateUnitIdsText] = useState("");
  const [duplicateShiftDays, setDuplicateShiftDays] = useState(1);

  // NEW: which unit card is expanded (null = all collapsed)
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);

  // Reset edits when assignments refresh
  useEffect(() => {
    setEditState({});
  }, [assignments]);

  const stepsById = useMemo(() => {
    const m = new Map<number, TestStep>();
    steps?.forEach((s) => m.set(s.id, s));
    return m;
  }, [steps]);

  const units = useMemo(() => {
    if (!assignments) return [] as { unit_id: string; rows: Assignment[] }[];

    const map = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      if (!map.has(a.unit_id)) map.set(a.unit_id, []);
      map.get(a.unit_id)!.push(a);
    });

    const list: { unit_id: string; rows: Assignment[] }[] = [];
    for (const [unit_id, arr] of map.entries()) {
      arr.sort((a, b) => {
        const oa = stepsById.get(a.step_id)?.order ?? a.step_id;
        const ob = stepsById.get(b.step_id)?.order ?? b.step_id;
        return oa - ob;
      });
      list.push({ unit_id, rows: arr });
    }

    list.sort((a, b) => a.unit_id.localeCompare(b.unit_id));
    return list;
  }, [assignments, stepsById]);

    const testerOptions = useMemo(
    () =>
      [
        // Group options: value is "group:<name>"
        ...(testerGroups
          ? Object.keys(testerGroups).map((groupName) => ({
              value: `group:${groupName}`,
              label: `${groupName} (group)`,
            }))
          : []),
        // Individual tester options
        ...(testers
          ? testers.map((t) => ({
              value: t,
              label: t,
            }))
          : []),
      ],
    [testerGroups, testers]
  );

  function buildBaseRow(a: Assignment): RowState {
    return {
      tester_id: a.tester_id ?? "",
      status: a.status,
      start_date: isoDateFromBackend(a.start_at),
      end_date: isoDateFromBackend(a.end_at),
      dirty: false,
    };
  }

  function getRowState(a: Assignment): RowState {
    const existing = editState[a.id];
    return existing ?? buildBaseRow(a);
  }

  function handleFieldChange(
    a: Assignment,
    field: keyof RowState,
    value: string
  ) {
    setEditState((prev) => {
      const current = prev[a.id] ?? buildBaseRow(a);
      let next: RowState = { ...current, [field]: value };

      if (field === "start_date") {
        if (next.end_date && next.end_date < value) {
          next.end_date = value;
        }
      } else if (field === "end_date") {
        if (next.start_date && value < next.start_date) {
          next.end_date = next.start_date;
        }
      }

      next.dirty = true;
      return { ...prev, [a.id]: next };
    });
  }

  function handleSuggest(unitId: string, stepId: number) {
    if (!assignments || !steps) return;

    const unitAssignments = assignments
      .filter((a) => a.unit_id === unitId)
      .sort((a, b) => {
        const oa = stepsById.get(a.step_id)?.order ?? a.step_id;
        const ob = stepsById.get(b.step_id)?.order ?? b.step_id;
        return oa - ob;
      });

    const idx = unitAssignments.findIndex((a) => a.step_id === stepId);
    if (idx === -1) return;
    const current = unitAssignments[idx];

    let suggestedStart: string;

    if (idx === 0) {
      const row = getRowState(current);
      suggestedStart = row.start_date || todayKey();
    } else {
      const prevAssignment = unitAssignments[idx - 1];
      const prevRow = getRowState(prevAssignment);
      const prevEnd = prevRow.end_date || prevRow.start_date || todayKey();
      suggestedStart = addDays(prevEnd, 1);
    }

    const step = stepsById.get(stepId);
    const isBurnIn = step?.name === "Burn-in Test";
    const durationDays = isBurnIn ? 8 : 1;
    const suggestedEnd = addDays(suggestedStart, durationDays - 1);

    const base = getRowState(current);
    setEditState((prev) => ({
      ...prev,
      [current.id]: {
        ...base,
        start_date: suggestedStart,
        end_date: suggestedEnd,
        dirty: true,
      },
    }));
  }

  /* =========================================================
     ✅ Duplicate schedule API call (supports multiple IDs)
     ========================================================= */
  async function duplicateSchedule(
    sourceUnit: string,
    newUnits: string[],
    shift: number
  ) {
    const token = localStorage.getItem("token");
  
    const res = await fetch(`${API_BASE_URL}/schedule/duplicate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        source_unit_id: sourceUnit,
        new_unit_ids: newUnits,
        day_shift: shift,
      }),
    });
  
    if (!res.ok) throw new Error(await res.text());
    await res.json();
  }
  ;

    if (!res.ok) throw new Error(await res.text());
    await res.json();
  }

  /* =========================================================
     Save all (unchanged)
     ========================================================= */
  async function handleSaveAll() {
    if (!assignments) return;

    setMessage(null);
    setErrorMsg(null);

    const dirtyEntries = Object.entries(editState).filter(
      ([, row]) => row.dirty
    );
    if (dirtyEntries.length === 0) {
      setMessage("No changes to save.");
      return;
    }

    try {
      setSaving(true);
      for (const [assignmentId, row] of dirtyEntries) {
        const payload: {
          tester_id?: string | null;
          status?: string;
          start_at?: string | null;
          end_at?: string | null;
        } = {
          tester_id: row.tester_id || null,
          status: row.status,
          start_at: row.start_date ? row.start_date + "T00:00:00" : null,
          end_at: row.end_date ? row.end_date + "T00:00:00" : null,
        };

        await updateAssignment.mutateAsync({ id: assignmentId, data: payload });
      }

      setMessage("Changes saved.");
      setEditState((prev) => {
        const next: typeof prev = {};
        for (const [id, row] of Object.entries(prev)) {
          next[id] = { ...row, dirty: false };
        }
        return next;
      });
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  // --- unchanged guards ---
  if (isLoading) return <div>Loading schedule…</div>;
  if (error)
    return (
      <div style={{ color: "red" }}>
        Error loading schedule: {(error as any).message}
      </div>
    );
  if (!assignments || assignments.length === 0)
    return <div>No assignments yet.</div>;

  /* =========================================================
     Render
     ========================================================= */
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__title-group">
          <h1>Scheduler</h1>
          <p>
            Plan test dates and assign testers. Click a unit block to expand its
            steps. <strong>Suggest</strong> auto-fills dates based on previous
            steps (Burn-in Test blocks 8 days).
          </p>
        </div>

        <button
          className="btn btn-primary btn-pill"
          onClick={handleSaveAll}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        <button
          className="btn btn-secondary btn-pill"
          style={{ marginLeft: 12 }}
          onClick={() => {
            if (!openUnitId) {
              prompt.alert(
                "Please click and expand a unit first, then duplicate from it.",
                "Duplicate Schedule"
              );
              return;
            }
            setShowDuplicateModal(true);
          }}
        >
          Duplicate Schedule
        </button>
      </header>

      {/* ✅ modal render with props */}
      {showDuplicateModal && (
        <DuplicateModal
          source={openUnitId}
          duplicateUnitIdsText={duplicateUnitIdsText}
          setDuplicateUnitIdsText={setDuplicateUnitIdsText}
          duplicateShiftDays={duplicateShiftDays}
          setDuplicateShiftDays={setDuplicateShiftDays}
          onClose={() => {
            setShowDuplicateModal(false);
            setDuplicateUnitIdsText("");
            setDuplicateShiftDays(1);
          }}
          onConfirm={duplicateSchedule}
        />
      )}

      {/* --- unchanged banners --- */}
      {errorMsg && (
        <div className="banner banner--error" style={{ marginBottom: 8 }}>
          {errorMsg}
        </div>
      )}
      {message && (
        <div className="banner banner--success" style={{ marginBottom: 8 }}>
          {message}
        </div>
      )}

      {/* --- unchanged unit cards/table --- */}
      {units.map(({ unit_id, rows }) => {
        const isOpen = openUnitId === unit_id;

        return (
          <section key={unit_id} className="card scheduler-card">
            <div
              className="scheduler-unit-header"
              onClick={() =>
                setOpenUnitId((prev) => (prev === unit_id ? null : unit_id))
              }
            >
              <div className="scheduler-unit-header-main">
                <div className="scheduler-unit-title">Unit {unit_id}</div>
                <div className="scheduler-unit-subtitle">
                  {rows.length} steps to schedule
                </div>
              </div>
              <div className="scheduler-unit-header-arrow">
                {isOpen ? "▴" : "▾"}
              </div>
            </div>

            {isOpen && (
              <div className="scheduler-table-wrapper">
                <table className="queue-table scheduler-table">
                  <thead>
                    <tr>
                      <th align="left">Step</th>
                      <th align="left">Tester</th>
                      <th align="left">Start date</th>
                      <th align="left">End date</th>
                      <th align="left">Status</th>
                      <th align="left">Auto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const step = stepsById.get(a.step_id);
                      const row = getRowState(a);

                      return (
                        <tr key={a.id}>
                          <td>
                            {step ? `${step.order}. ${step.name}` : a.step_id}
                          </td>
                          <td>
                            <select
                              className="scheduler-field"
                              value={row.tester_id || ""}
                              onChange={(e) =>
                                handleFieldChange(a, "tester_id", e.target.value)
                              }
                            >
                              <option value="">(unassigned)</option>
                            
                              {testerOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="scheduler-field"
                              type="date"
                              value={row.start_date}
                              onChange={(e) =>
                                handleFieldChange(
                                  a,
                                  "start_date",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="scheduler-field"
                              type="date"
                              value={row.end_date}
                              onChange={(e) =>
                                handleFieldChange(
                                  a,
                                  "end_date",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="scheduler-field"
                              value={row.status}
                              onChange={(e) =>
                                handleFieldChange(
                                  a,
                                  "status",
                                  e.target.value
                                )
                              }
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="RUNNING">RUNNING</option>
                              <option value="PASS">PASS</option>
                              <option value="FAIL">FAIL</option>
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-pill"
                              style={{ fontSize: 11, padding: "3px 10px" }}
                              onClick={() => handleSuggest(unit_id, a.step_id)}
                            >
                              Suggest
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}









