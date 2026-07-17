import { Footer } from "../layout/Footer";
import "../../journey.css";
import { AboutSection } from "./AboutSection";
import { ContactSection } from "./ContactSection";
import { ListeningCapsuleSection } from "./ListeningCapsuleSection";
import { PhilosophySection } from "./PhilosophySection";
import { PlanetWorldJourneySection } from "./PlanetWorldJourneySection";
import { ProjectsSection } from "./ProjectsSection";
import { TechStackSection } from "./TechStackSection";

export default function PlanetJourneyExperience() {
  return (
    <PlanetWorldJourneySection>
      <AboutSection />
      <TechStackSection />
      <ProjectsSection />
      <ListeningCapsuleSection />
      <PhilosophySection />
      <ContactSection />
      <Footer />
    </PlanetWorldJourneySection>
  );
}
