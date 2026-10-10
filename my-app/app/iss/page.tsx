import type { Metadata } from "next";

import IssTracker from "./IssTracker";
import SpaceWeatherPanel from "./SpaceWeatherPanel";

export const metadata: Metadata = {
  title: "ISS Live Tracker",
  description: "Live position of the International Space Station, updated every few seconds.",
};

export default function IssPage() {
  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header>
          <h1 className="text-3xl font-bold">ISS Live Tracker</h1>
          <p className="mt-1 text-slate-400">
            The International Space Station circles Earth about every 92 minutes. The shaded area is
            night, the ring is where the station is above the horizon, the solid line is where it has been
            over the last 45 minutes, and the dashed line is where it will go during the next orbit.
          </p>
        </header>
        <IssTracker />
        <SpaceWeatherPanel />
      </div>
    </main>
  );
}
