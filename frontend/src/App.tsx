import { WorkoutBuilder } from "./pages/WorkoutBuilder";

export default function App() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-400">Garmin Coach</h1>
        <p className="text-sm text-slate-400">Describe a workout. Push to your device.</p>
      </header>
      <WorkoutBuilder />
    </div>
  );
}
