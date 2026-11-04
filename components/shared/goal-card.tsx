import { Clock3 } from "lucide-react";
import { ReactNode } from "react";

export function GoalCard({
  title,
  value,
  total,
  unit,
  caption,
  action,
}: {
  title: string;
  value: number;
  total: number;
  unit: string;
  caption: string;
  action?: ReactNode;
}) {
  const progress = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="goal-card">
      <div className="goal-head">
        <div>
          <h3>{title}</h3>
        </div>
        <span className="goal-icon" aria-hidden="true">
          <Clock3 />
        </span>
      </div>
      <div className="goal-meter">
        <div
          className="ring"
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
        >
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="goal-copy">
          <strong>
            {value} {unit && <small>{unit}</small>}
          </strong>
          <small>{caption}</small>
        </div>
      </div>
      {action && (
        <div className="goal-bottom">
          <span />
          {action}
        </div>
      )}
    </div>
  );
}
