import { Navbar } from "./components/layout/Navbar";
import { ProgressiveJourney } from "./components/sections/ProgressiveJourney";
import { HeroSection } from "./components/sections/HeroSection";

export default function App() {
  return (
    <div className="site-shell antialiased font-body-md text-body-md" style={{ overflowX: "clip" }}>
      <Navbar />

      <main className="relative">
        <HeroSection />
        <ProgressiveJourney />
      </main>
    </div>
  );
}
