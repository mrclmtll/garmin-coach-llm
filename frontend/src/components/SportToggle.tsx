import type { Sport } from "../api/types";
import { SPORT_ICONS, SPORT_LABELS } from "./SportIcon";

const ORDER: Sport[] = ["running", "cycling", "swimming"];

interface Props {
  value: Sport;
  onChange: (sport: Sport) => void;
}

export function SportToggle({ value, onChange }: Props) {
  return (
    <div className="sport-toggle" role="radiogroup" aria-label="Sport">
      {ORDER.map((sport) => (
        <button
          key={sport}
          type="button"
          role="radio"
          aria-checked={value === sport}
          title={SPORT_LABELS[sport]}
          onClick={() => onChange(sport)}
          className={`sport-toggle-btn ${value === sport ? "sport-toggle-btn-active" : ""}`}
        >
          <span className="sport-toggle-icon" dangerouslySetInnerHTML={{ __html: SPORT_ICONS[sport] }} />
        </button>
      ))}
    </div>
  );
}
