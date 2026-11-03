type StatCard = { value: string | number; label: string };

export function WordCountBadge({ count }: { count: number }) {
  return (
    <span className="word-count">
      {count}× pesquisada{count === 1 ? "" : "s"}
    </span>
  );
}

export function StatCards({
  items,
  className = "",
}: {
  items: StatCard[];
  className?: string;
}) {
  return (
    <div className={`stats-row ${className}`.trim()}>
      {items.map((item) => (
        <div className="stat-card stat-card-home" key={item.label}>
          <strong className="stat-icon stat-value">{item.value}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}
