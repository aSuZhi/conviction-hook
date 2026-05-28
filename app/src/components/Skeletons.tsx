export function MarketCardSkeletons() {
  return (
    <div className="markets-view" aria-label="Loading markets">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="market-card skeleton-card" key={index}>
          <span />
          <strong />
          <p />
          <p />
        </div>
      ))}
    </div>
  );
}
