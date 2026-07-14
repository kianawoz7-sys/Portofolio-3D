import { Footer } from "./components/layout/Footer";
import { Navbar } from "./components/layout/Navbar";
import { AboutSection } from "./components/sections/AboutSection";
import { ContactSection } from "./components/sections/ContactSection";
import { CosmicPOVSection } from "./components/sections/CosmicPOVSection";
import { HeroSection } from "./components/sections/HeroSection";
import { ListeningCapsuleSection } from "./components/sections/ListeningCapsuleSection";
import { PlanetWorldJourneySection } from "./components/sections/PlanetWorldJourneySection";
import { PhilosophySection } from "./components/sections/PhilosophySection";
import { ProjectsSection } from "./components/sections/ProjectsSection";
import { TechStackSection } from "./components/sections/TechStackSection";

export default function App() {
  return (
    <div className="site-shell antialiased font-body-md text-body-md" style={{ overflowX: "clip" }}>
      <Navbar />

      <main className="relative">
        <HeroSection />
        <CosmicPOVSection />
        <PlanetWorldJourneySection>
          <AboutSection />
          <TechStackSection />
          <ProjectsSection />
          <ListeningCapsuleSection />
          <PhilosophySection />
          <ContactSection />
          <Footer />
        </PlanetWorldJourneySection>
      </main>
    </div>
  );
}
