import type { Sport } from "../api/types";
import cyclingIcon from "../assets/icons/cycling.svg?raw";
import runningIcon from "../assets/icons/running.svg?raw";
import swimmingIcon from "../assets/icons/swimming.svg?raw";

// Swap an icon by replacing its file in src/assets/icons/ — any SVG using
// fill="currentColor" and a 0 0 24 24 viewBox will pick up sizing and color.
export const SPORT_ICONS: Record<Sport, string> = {
  running: runningIcon,
  cycling: cyclingIcon,
  swimming: swimmingIcon,
};

export const SPORT_LABELS: Record<Sport, string> = {
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
};

function isKnownSport(sport: string | null | undefined): sport is Sport {
  return !!sport && sport in SPORT_ICONS;
}

interface Props {
  // Garmin's raw sport values aren't limited to our three sports, so this
  // accepts any string and silently renders nothing for the rest.
  sport: string | null | undefined;
  className?: string;
}

export function SportIcon({ sport, className }: Props) {
  if (!isKnownSport(sport)) return <span className={className} aria-hidden />;
  return (
    <span
      className={className}
      title={SPORT_LABELS[sport]}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: SPORT_ICONS[sport] }}
    />
  );
}
