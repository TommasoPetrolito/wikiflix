import './ActorCard.css';

export interface PersonCardData {
  id: string | number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
  known_for?: Array<{ title?: string; name?: string }>;
}

interface ActorCardProps {
  actor: PersonCardData;
  onClick: (actor: PersonCardData) => void;
}

export const ActorCard = ({ actor, onClick }: ActorCardProps) => {
  const getPosterUrl = (path: string | null) => {
    if (!path) return '/placeholder.jpg';
    return `https://image.tmdb.org/t/p/w500${path}`;
  };

  const knownFor = actor.known_for?.slice(0, 3).map(item => item.title || item.name).join(', ') || '';

  return (
    <div 
      className="actor-card"
      onClick={() => onClick(actor)}
      tabIndex={0}
      role="button"
      aria-label={`${actor.name} - ${actor.known_for_department || 'Actor'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(actor);
        }
      }}
    >
      <div className="actor-card-image-container">
        {actor.profile_path ? (
          <img 
            src={getPosterUrl(actor.profile_path)} 
            alt={actor.name} 
            className="actor-card-image"
            loading="lazy"
          />
        ) : (
          <div className="actor-card-placeholder">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        )}
      </div>
      <div className="actor-card-info">
        <h3 className="actor-card-name">{actor.name}</h3>
        {actor.known_for_department && (
          <p className="actor-card-department">{actor.known_for_department}</p>
        )}
        {knownFor && (
          <p className="actor-card-known-for">Known for: {knownFor}</p>
        )}
      </div>
    </div>
  );
};

