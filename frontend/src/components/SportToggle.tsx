import type { Sport } from "../api/types";
import cyclingIcon from "../assets/icons/cycling.svg?raw";
import runningIcon from "../assets/icons/running.svg?raw";
import swimmingIcon from "../assets/icons/swimming.svg?raw";

// Swap an icon by replacing its file in src/assets/icons/ — any SVG using
// fill="currentColor" and a 0 0 24 24 viewBox will pick up sizing and color.
const ICONS: Record<Sport, string> = {
  running: runningIcon,
  cycling: cyclingIcon,
  swimming: swimmingIcon,
};

const LABELS: Record<Sport, string> = {
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
};

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
          title={LABELS[sport]}
          onClick={() => onChange(sport)}
          className={`sport-toggle-btn ${value === sport ? "sport-toggle-btn-active" : ""}`}
        >
          <span className="sport-toggle-icon" dangerouslySetInnerHTML={{ __html: ICONS[sport] }} />
        </button>
      ))}
    </div>
  );
}
