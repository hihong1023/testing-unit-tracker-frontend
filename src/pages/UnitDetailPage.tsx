// src/pages/UnitDetailPage.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useUnitDetails, useSteps } from "../hooks";
import { getToken } from "../api";
import { usePrompt } from "../components/PromptProvider";

export const API_BASE =
  "https://testing-unit-tracker-backend-cyfhe5cffve4cgbj.southeastasia-01.azurewebsites.net";

function formatSingaporeDateTime(iso?: string | null): string {
  if (!iso) return "-";

  // Backend uses datetime.utcnow() → treat as UTC & convert to SGT (+8)
  const utc = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const plus8 = new Date(utc.getTime() + 0 * 60 * 60 * 1000);

  const y = plus8.getFullYear();
  const m = String(plus8.getMonth() + 1).padStart(2, "0");
  const d = String(plus8.getDate()).padStart(2, "0");
  const hh = String(plus8.getHours()).padStart(2, "0");
  const mm = String(plus8.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export default function UnitDetailPage() {
  const prompt = usePrompt();
  const navigate = useNavigate();
  const { unitId } = useParams();
  const { data, isLoading, error } = useUnitDetails(unitId || "");
  const { data: steps } = useSteps();

  if (!unitId)
    return (
      <div className="page">
        <p className="text-error">No unit selected.</p>
      </div>
    );
  if (isLoading)
    return (
      <div className="page">
        <p className="text-muted">Loading unit details…</p>
      </div>
    );
  if (error)
    return (
      <div className="page">
        <p className="text-error">Error: {(error as any).message}</p>
      </div>
    );
  if (!data || !steps)
    return (
      <div className="page">
        <p className="text-error">No data.</p>
      </div>
    );

  // Build lookup maps for convenience
  const assignmentsByStep = new Map<number, (typeof data.assignments)[number]>();
  data.assignments.forEach((a) => assignmentsByStep.set(a.step_id, a));

  const resultsByStep = new Map<number, (typeof data.results)[number]>();
  data.results.forEach((r) => resultsByStep.set(r.step_id, r));

  // Progress: only count non-skipped steps
  const nonSkippedAssignments = data.assignments.filter(
    (a: any) => !a.skipped // if skipped is undefined, this is still treated as "not skipped"
  );
  const nonSkippedStepIds = new Set(nonSkippedAssignments.map((a) => a.step_id));

  const passedSteps = data.results.filter(
    (r) => r.passed && nonSkippedStepIds.has(r.step_id)
  ).length;
  const totalSteps = nonSkippedStepIds.size || steps.length; // fallback to all steps if skipped isn't wired yet
  const progress = totalSteps ? (passedSteps / totalSteps) * 100 : 0;

  const unitLabel = (data.unit as any).unit_id || data.unit.id;

  async function handleDownloadZip() {
    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/reports/unit/${encodeURIComponent(data.unit.id)}/zip`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.unit.id}_logs.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      prompt.alert(`Download failed: ${err.message || err}`, "Download Error");
    }
  }

  async function handleDownloadStepLogs(stepId: number) {
    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/reports/unit/${encodeURIComponent(
          data.unit.id
        )}/step/${stepId}/zip`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.unit.id}_step${stepId}_logs.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      prompt.alert(
        `Download step logs failed: ${err.message || err}`,
        "Download Error"
      );
    }
  }

  async function handleRemoveStepLogs(stepId: number) {
    const ok = await prompt.confirm(
      "Remove all log files for this step?",
      "Remove Evidence",
      { confirmText: "Remove", cancelText: "Cancel" }
    );
    if (!ok) return;

    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/reports/unit/${encodeURIComponent(
          data.unit.id
        )}/step/${stepId}/evidence`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }

      // simplest: full reload so evidence counts refresh
      window.location.reload();
    } catch (err: any) {
      prompt.alert(
        `Failed to remove logs: ${err.message || err}`,
        "Remove Error"
      );
    }
  }

  async function handleRenameUnit() {
    const newId = window.prompt("Enter new unit ID:", unitLabel);
    if (!newId) return;

    const trimmed = newId.trim();
    if (!trimmed || trimmed === unitLabel) return;

    const confirm = await prompt.confirm(
      `Rename unit "${unitLabel}" to "${trimmed}"?\n\nAll assignments, results, and evidence will follow the new ID.`,
      "Rename Unit",
      { confirmText: "Rename", cancelText: "Cancel" }
    );
    if (!confirm) return;

    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/units/${encodeURIComponent(data.unit.id)}/rename`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ new_unit_id: trimmed }),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      prompt.alert(
        `Unit ID has been renamed to "${trimmed}".`,
        "Rename Successful"
      );

      // Navigate to new detail page so hooks refetch using new ID
      navigate(`/units/${encodeURIComponent(trimmed)}/details`, {
        replace: true,
      });
    } catch (err: any) {
      prompt.alert(`Rename failed: ${err.message || err}`, "Rename Error");
    }
  }

  async function handleToggleSkip(
    assignmentId: string | undefined,
    currentSkipped: boolean | undefined
  ) {
    if (!assignmentId) return;

    const makeSkipped = !currentSkipped;

    // Tiny confirm message (only when skipping)
    if (makeSkipped) {
      const ok = await prompt.confirm(
        "Mark this step as 'Not tested' (N/A) for this unit?\nIt will be removed from progress and queues.",
        "Mark Not Tested",
        { confirmText: "Mark not tested", cancelText: "Cancel" }
      );
      if (!ok) return;
    }

    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/assignments/${encodeURIComponent(assignmentId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ skipped: makeSkipped }),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      // easiest: reload page so status / progress update
      window.location.reload();
    } catch (err: any) {
      prompt.alert(
        `Failed to update step: ${err.message || err}`,
        "Update Error"
      );
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div className="page-header__title-group">
          <h1>Unit {unitLabel}</h1>
          <p>Detailed test history, assignments, and evidence logs.</p>
        </div>

        <div className="unit-detail-header-right">
          <div className="unit-detail-progress">
            <div className="unit-detail-progress-top">
              <span className="unit-detail-progress-label">Progress</span>
              <span className="unit-detail-progress-value">
                {progress.toFixed(0)}%
              </span>
            </div>
            <div className="unit-detail-progress-bar">
              <div
                className="unit-detail-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                }}
              />
            </div>
            <div className="unit-detail-progress-meta">
              {passedSteps}/{totalSteps} steps passed
            </div>
          </div>

          <span className="unit-detail-status-pill">
            {data.unit.status ?? "UNKNOWN"}
          </span>
        </div>
      </header>

      {/* Summary + actions */}
      <section className="card unit-detail-summary-card">
        <div className="unit-detail-summary-grid">
          <div className="unit-detail-meta">
            <div className="unit-detail-meta-row">
              <span className="unit-detail-meta-label">Unit ID</span>
              <span className="unit-detail-meta-value">{unitLabel}</span>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleRenameUnit}
              >
                Rename unit
              </button>
            </div>
            <div className="unit-detail-meta-row">
              <span className="unit-detail-meta-label">SKU</span>
              <span className="unit-detail-meta-value">
                {data.unit.sku || "-"}
              </span>
            </div>
            <div className="unit-detail-meta-row">
              <span className="unit-detail-meta-label">LOT</span>
              <span className="unit-detail-meta-value">
                {data.unit.lot || "-"}
              </span>
            </div>
          </div>

          <div className="unit-detail-actions">
            <p className="text-muted" style={{ marginBottom: 8 }}>
              Export all attached logs and screenshots for this unit in one ZIP.
            </p>
            <button className="btn btn-primary" onClick={handleDownloadZip}>
              Download all evidence (ZIP)
            </button>
          </div>
        </div>
      </section>

      {/* Steps table */}
      <section className="card unit-detail-steps-card">
        <div className="card__header">
          <div>
            <div className="card__title">Test steps</div>
            <div className="card__subtitle">
              Assignment status, tester, result, and log evidence for each step.
            </div>
          </div>
        </div>

        <div className="unit-detail-table-wrapper">
          <table className="unit-detail-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Step</th>
                <th>Tester</th>
                <th>Assignment Status</th>
                <th>Result</th>
                <th>Finished (SGT)</th>
                <th>Logs</th>
              </tr>
            </thead>
            <tbody>
              {steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((s) => {
                  const a = assignmentsByStep.get(s.id) as any;
                  const r = resultsByStep.get(s.id);

                  const skipped = !!a?.skipped;

                  let resultLabel = "—";
                  let resultClass = "result-pill result-pill--none";
                  if (r) {
                    if (r.passed) {
                      resultLabel = "PASS";
                      resultClass = "result-pill result-pill--pass";
                    } else {
                      resultLabel = "FAIL";
                      resultClass = "result-pill result-pill--fail";
                    }
                  }

                  const fileCount = r?.files?.length ?? 0;

                  return (
                    <tr key={s.id}>
                      <td>{s.order}</td>
                      <td>{s.name}</td>
                      <td>{a?.tester_id || "-"}</td>
                      <td>
                        <div>
                          {skipped
                            ? "SKIPPED (N/A)"
                            : a?.status || "-"}
                        </div>
                        {/* Allow marking/unmarking as not tested only if no result yet */}
                        {!r && a && (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            style={{ marginTop: 4 }}
                            onClick={() =>
                              handleToggleSkip(a.id, a.skipped)
                            }
                          >
                            {skipped ? "Re-enable step" : "Mark not tested"}
                          </button>
                        )}
                      </td>
                      <td>
                        <span className={resultClass}>{resultLabel}</span>
                      </td>
                      <td>
                        {r ? formatSingaporeDateTime(r.finished_at) : "-"}
                      </td>
                      <td>
                        {fileCount === 0 ? (
                          <span className="unit-detail-evidence-empty">
                            No files
                          </span>
                        ) : (
                          <div className="unit-detail-evidence">
                            <span className="unit-detail-evidence-count">
                              {fileCount} file{fileCount !== 1 ? "s" : ""}
                            </span>
                            <div className="unit-detail-evidence-actions">
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => handleDownloadStepLogs(s.id)}
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger-outline btn-xs"
                                onClick={() => handleRemoveStepLogs(s.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

