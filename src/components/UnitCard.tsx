// src/components/UnitCard.tsx
import { UnitSummary } from "../api";
import { Link } from "react-router-dom";

interface Props {
  unit: UnitSummary;
}

export default function UnitCard({ unit }: Props) {
  return (
    <Link
      to={`/units/${unit.unit_id}`}
      style={{
        border: "1px solid #ccc",
        borderRadius: 8,
        padding: "1rem",
        width: 200,
        height: 160,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        {unit.unit_id}
      </div>
      <div>
        <div>Status: {unit.status}</div>
        <div>Progress: {unit.progress_percent.toFixed(0)}%</div>
        {unit.next_step_name && (
          <div>Next: {unit.next_step_name}</div>
        )}
      </div>
    </Link>
  );
}
