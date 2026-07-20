import { WorkoutBuilder } from "./pages/WorkoutBuilder";

export default function App() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-accent-400">Garmin Coach</h1>
          <p className="text-sm text-slate-400">Describe a workout. Push to your device.</p>
        </div>
        <WorkoutBuilder.SidebarToggle />
      </header>
      <WorkoutBuilder />
    </div>
  );
}
