// src/components/UnitCard.tsx
import { Link } from "react-router-dom";

interface UnitSummary {
  unit_id: string;
  status: string;
  progress_percent: number;
  passed_steps: number;
  total_steps: number;
  next_step_id?: number;
  next_step_name?: string;
}

interface Props {
  unit: UnitSummary;
}

function statusKey(
  status: string
): "completed" | "in-progress" | "pending" | "issue" {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "IN_PROGRESS":
      return "in-progress";
    case "PENDING":
      return "pending";
    default:
      return "issue";
  }
}

export default function UnitCard({ unit }: Props) {
  const pct = Math.max(0, Math.min(100, unit.progress_percent || 0));
  const key = statusKey(unit.status);

  const nextLabel =
    unit.status === "COMPLETED"
      ? "All steps done"
      : unit.next_step_name
      ? unit.next_step_name
      : "—";

  // ✅ IMPORTANT: encode unit_id for URLs (fixes #, spaces, etc.)
  const unitPath = `/units/${encodeURIComponent(unit.unit_id)}`;

  return (
    <Link to={unitPath} className={`unit-tile unit-tile--${key}`}>
      <div className="unit-tile__id">{unit.unit_id}</div>

      <div className="unit-tile__body">
        <div className="unit-tile__row">
          <span className="unit-tile__label">Status</span>
          <span className="unit-tile__value">{unit.status}</span>
        </div>
        <div className="unit-tile__row">
          <span className="unit-tile__label">Progress</span>
          <span className="unit-tile__value">{pct.toFixed(0)}%</span>
        </div>
        <div className="unit-tile__row">
          <span className="unit-tile__label">Next</span>
          <span className="unit-tile__value">{nextLabel}</span>
        </div>
      </div>
    </Link>
  );
}
