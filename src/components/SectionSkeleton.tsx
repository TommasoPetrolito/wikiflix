import './SectionSkeleton.css';

export const SectionSkeleton = () => {
  return (
    <section className="skeleton-section">
      <div className="skeleton-header">
        <div className="skeleton-title"></div>
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-poster"></div>
          </div>
        ))}
      </div>
    </section>
  );
};

