import { DocsGuide } from "./DocsGuide";
import { HeroSection } from "./HeroSection";
import { OpenSourceSection } from "./OpenSourceSection";
import { ProofSection } from "./ProofSection";
import { StackFlowSection } from "./StackFlowSection";
import { StackRibbon } from "./StackRibbon";

export default function LandingPage() {
  return (
    <div className="bs-landing overflow-hidden text-[var(--bs-text)]">
      <HeroSection />
      <StackRibbon />
      <OpenSourceSection />
      <DocsGuide />
      <StackFlowSection />
      <ProofSection />
    </div>
  );
}
