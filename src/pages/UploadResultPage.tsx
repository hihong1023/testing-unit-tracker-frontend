// src/pages/UploadResultPage.tsx
import React, { FormEvent, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUnits, useSteps } from "../hooks";
import { createResult, uploadEvidence } from "../api";

export default function UploadResultPage() {
  const qc = useQueryClient();

  const { data: units, isLoading: unitsLoading, error: unitsError } = useUnits();
  const { data: steps, isLoading: stepsLoading, error: stepsError } = useSteps();

  const [unitId, setUnitId] = useState("");
  const [stepId, setStepId] = useState("");
  const [passed, setPassed] = useState<"PASS" | "FAIL">("PASS");

  // ✅ Finished date starts EMPTY (user must choose)
  const [finishedAt, setFinishedAt] = useState<string>("");

  const [resultId, setResultId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sortedSteps = useMemo(
    () => (steps ? [...steps].sort((a, b) => a.order - b.order) : []),
    [steps]
  );

  async function handleSubmitResult(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setErrorMsg(null);

    if (!unitId || !stepId) {
      setErrorMsg("Please select both unit and step.");
      return;
    }

    // ✅ Only send finished_at if user selected a date
    // Use midday to avoid timezone shifting when backend stores tz-aware timestamps
    const finished_at =
      finishedAt && finishedAt.trim() ? `${finishedAt}T12:00:00` : undefined;

    try {
      setSubmitting(true);

      const res = await createResult({
        unit_id: unitId,
        step_id: Number(stepId),
        metrics: {},
        passed: passed === "PASS",
        finished_at, // ✅ undefined if user didn't pick a date
      });

      setResultId(res.id);
      setMessage("Result saved. You can now upload log files for this step.");

      // ✅ refresh matrix + unit detail
      await qc.invalidateQueries({ queryKey: ["matrixDetails"] });
      await qc.invalidateQueries({ queryKey: ["unitDetails", unitId] });
      await qc.invalidateQueries({ queryKey: ["unit", unitId] });
    } catch (err: any) {
      setErrorMsg(`Failed to submit result: ${err?.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadFiles() {
    if (!resultId || !unitId || !stepId) {
      setErrorMsg("Please submit the result first before uploading files.");
      return;
    }
    if (!files || files.length === 0) {
      setErrorMsg("Please choose one or more files to upload.");
      return;
    }

    setErrorMsg(null);
    setMessage(null);

    try {
      setUploading(true);
      const promises: Promise<any>[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files.item(i);
        if (!f) continue;
        promises.push(uploadEvidence(unitId, Number(stepId), resultId, f));
      }
      await Promise.all(promises);

      setMessage("All files uploaded successfully.");

      // optional refresh (if logs count is shown)
      await qc.invalidateQueries({ queryKey: ["matrixDetails"] });
      await qc.invalidateQueries({ queryKey: ["unitDetails", unitId] });
      await qc.invalidateQueries({ queryKey: ["unit", unitId] });
    } catch (err: any) {
      setErrorMsg(`File upload failed: ${err?.message || String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  const isPass = passed === "PASS";

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__title-group">
          <h1>Upload test result</h1>
          <p>
            1) Save the result for a <strong>unit + step</strong> · 2) Upload{" "}
            <strong>log files</strong> as evidence.
          </p>
        </div>
      </header>

      {(unitsLoading || stepsLoading) && <div>Loading…</div>}

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

      {errorMsg && <div className="banner banner--error">{errorMsg}</div>}
      {message && <div className="banner banner--success">{message}</div>}

      <div className="upload-layout">
        {/* LEFT CARD – result details */}
        <section className="card upload-card upload-card--left">
          <div className="card__body">
            <div className="upload-card-header">
              <div>
                <div className="card__title">Result details</div>
                <div className="card__subtitle">
                  This will feed into unit detail &amp; matrix views.
                </div>
              </div>

              <div
                className={
                  "result-pill " +
                  (isPass ? "result-pill--pass" : "result-pill--fail")
                }
              >
                {isPass ? "PASS" : "FAIL"}
              </div>
            </div>

            <form onSubmit={handleSubmitResult}>
              <div className="upload-form-grid">
                {/* Unit */}
                <div className="upload-field">
                  <label className="upload-label">Unit</label>
                  <select
                    className="upload-control"
                    value={unitId}
                    onChange={(e) => {
                      setUnitId(e.target.value);
                      setResultId(null);
                      setMessage(null);
                    }}
                  >
                    <option value="">-- select unit --</option>
                    {units?.map((u) => (
                      <option key={u.unit_id} value={u.unit_id}>
                        {u.unit_id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step */}
                <div className="upload-field">
                  <label className="upload-label">Step</label>
                  <select
                    className="upload-control"
                    value={stepId}
                    onChange={(e) => {
                      setStepId(e.target.value);
                      setResultId(null);
                      setMessage(null);
                    }}
                  >
                    <option value="">-- select step --</option>
                    {sortedSteps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.order}. {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Result */}
                <div className="upload-field">
                  <label className="upload-label">Result</label>
                  <select
                    className="upload-control"
                    value={passed}
                    onChange={(e) => setPassed(e.target.value as "PASS" | "FAIL")}
                  >
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                  </select>
                </div>

                {/* Finished date */}
                <div className="upload-field">
                  <label className="upload-label">
                    Finished date <span style={{ fontSize: 11, color: "#6b7280" }}>(optional)</span>
                  </label>
                  <input
                    type="date"
                    className="upload-control"
                    value={finishedAt}
                    onChange={(e) => setFinishedAt(e.target.value)}
                  />
                  <div className="upload-helper" style={{ fontSize: 11, color: "#6b7280" }}>
                    Leave blank to keep date as “-” in Matrix / Unit detail.
                  </div>
                </div>

                {/* Current selection summary */}
                <div className="upload-selection-row">
                  <div className="upload-context-label">Current selection</div>
                  <div className="upload-context-value">
                    <span>Unit: {unitId || "—"}</span>
                    <span>
                      Step:{" "}
                      {stepId
                        ? sortedSteps.find((s) => s.id === Number(stepId))?.name ?? stepId
                        : "—"}
                    </span>
                    <span>Result: {passed}</span>
                    <span>Finished: {finishedAt || "—"}</span>
                  </div>
                </div>

                {/* Submit */}
                <div className="upload-submit-row">
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit result"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* RIGHT CARD – log files */}
        <section className="card upload-card upload-card--right">
          <div className="card__body upload-log-body">
            <div className="card__title">Log files</div>
            <div className="card__subtitle">
              Attach measurement logs or screenshots for this result.
            </div>

            <ol className="upload-steps">
              <li>
                Select <strong>unit</strong> and <strong>step</strong>.
              </li>
              <li>
                Click <strong>Submit result</strong>.
              </li>
              <li>
                Choose files and click <strong>Upload files</strong>.
              </li>
            </ol>

            <div className="upload-files-row">
              <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleUploadFiles}
                disabled={uploading || !resultId}
              >
                {uploading ? "Uploading…" : "Upload files"}
              </button>
            </div>

            {!resultId && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: "0.4rem" }}>
                Result not yet created for this unit/step — submit result first.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
