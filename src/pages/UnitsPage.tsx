// src/pages/UnitsPage.tsx
import { useState, FormEvent, useMemo } from "react";
import { useUnits, useCreateUnit, useDeleteUnit } from "../hooks";
import UnitCard from "../components/UnitCard";
import { getRole } from "../api";
import { usePrompt } from "../components/PromptProvider";

type StatusFilter = "all" | "active" | "completed";
type SortBy = "unit" | "progress";

export default function UnitsPage() {
  const prompt = usePrompt();
  const role = getRole();
  const isSupervisor = role === "supervisor";

  const { data, isLoading, error } = useUnits();
  const [newUnitId, setNewUnitId] = useState("");
  const createUnit = useCreateUnit();
  const deleteUnit = useDeleteUnit();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("unit");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newUnitId.trim()) return;
    createUnit.mutate(newUnitId.trim());
    setNewUnitId("");
  }

  async function handleDelete(unitId: string) {
    const ok = await prompt.confirm(
      `Delete unit ${unitId}? This cannot be undone.`,
      "Delete Unit",
      { confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!ok) return;

    deleteUnit.mutate(unitId);
  }

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.length;
    const completed = data.filter((u) => u.status === "COMPLETED").length;
    const active = total - completed;
    return { total, active, completed };
  }, [data]);

  const visibleUnits = useMemo(() => {
    if (!data) return [];

    let list = [...data];

    // Filter
    if (statusFilter === "active") {
      list = list.filter((u) => u.status !== "COMPLETED");
    } else if (statusFilter === "completed") {
      list = list.filter((u) => u.status === "COMPLETED");
    }

    // Sort
    if (sortBy === "unit") {
      list.sort((a, b) => a.unit_id.localeCompare(b.unit_id));
    } else if (sortBy === "progress") {
      list.sort((a, b) => b.progress_percent - a.progress_percent);
    }

    return list;
  }, [data, statusFilter, sortBy]);

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__title-group">
          <h1>Units Dashboard</h1>
          <p>Monitor test progress and status across all units.</p>
        </div>

        {stats && (
          <div className="units-summary">
            <div className="units-summary-chip">
              <span className="units-summary-label">Total</span>
              <span className="units-summary-value">{stats.total}</span>
            </div>
            <div className="units-summary-chip">
              <span className="units-summary-label">Active</span>
              <span className="units-summary-value">{stats.active}</span>
            </div>
            <div className="units-summary-chip">
              <span className="units-summary-label">Completed</span>
              <span className="units-summary-value">{stats.completed}</span>
            </div>
          </div>
        )}
      </header>

      {/* Single control card: create + filter together */}
      <section className="card">
        <div className="units-controls-grid">
          {isSupervisor && (
            <div className="units-controls-panel">
              <div>
                <div className="card__title">Create new unit</div>
                <div className="card__subtitle">
                  Add a unit ID to start tracking its tests.
                </div>
              </div>

              <form className="unit-create-form" onSubmit={handleCreate}>
                <input
                  className="form-control"
                  value={newUnitId}
                  onChange={(e) => setNewUnitId(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  Create unit
                </button>
              </form>
            </div>
          )}

          <div className="units-controls-panel">
            <div>
              <div className="card__title">Filter &amp; sort</div>
              <div className="card__subtitle">
                Narrow down units by status and ordering.
              </div>
            </div>

            <div className="units-toolbar">
              <div className="units-toolbar-group">
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="active">Active (not completed)</option>
                  <option value="completed">Completed only</option>
                </select>
              </div>

              <div className="units-toolbar-group">
                <label className="form-label">Sort by</label>
                <select
                  className="form-control"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                >
                  <option value="unit">Unit ID</option>
                  <option value="progress">Progress (desc)</option>
                </select>
              </div>
            </div>

            {isLoading && <p className="text-muted">Loading units…</p>}
            {error && (
              <p className="text-error">
                Error: {(error as any).message ?? "Failed to load units"}
              </p>
            )}

            {!isLoading && !error && visibleUnits.length === 0 && (
              <p className="text-muted" style={{ marginTop: 8 }}>
                No units found for this filter.
              </p>
            )}

            {stats && !isLoading && !error && visibleUnits.length > 0 && (
              <p className="text-muted" style={{ marginTop: 8 }}>
                Showing <strong>{visibleUnits.length}</strong> of{" "}
                <strong>{stats.total}</strong> units.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Units grid */}
      {visibleUnits.length > 0 && (
        <section className="units-grid">
          {visibleUnits.map((u) => (
            <div key={u.unit_id} className="unit-wrapper">
              {/* Delete button only for supervisor */}
              {isSupervisor && (
                <button
                  type="button"
                  onClick={() => handleDelete(u.unit_id)}
                  className="unit-delete-btn"
                  title="Delete unit"
                >
                  ×
                </button>
              )}
              <UnitCard unit={u} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

