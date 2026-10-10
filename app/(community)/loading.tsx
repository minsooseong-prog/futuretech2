export default function Loading() {
  return (
    <div className="loading-state" aria-label="불러오는 중" role="status">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-banner" />
      <div className="member-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div className="skeleton skeleton-card" key={i} />
        ))}
      </div>
      <span className="sr-only">불러오는 중입니다.</span>
    </div>
  );
}
