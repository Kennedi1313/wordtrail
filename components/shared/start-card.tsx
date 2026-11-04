import type { ReactNode } from "react";

export function StartCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`reading-start-card ${className}`.trim()}>
      <div className="reading-start-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
        {action}
      </div>
    </div>
  );
}
