import { DocsGuide } from "./DocsGuide";
import { GuardrailsSection } from "./GuardrailsSection";
import { HeroSection } from "./HeroSection";
import { OpenSourceSection } from "./OpenSourceSection";
import { StackFlowSection } from "./StackFlowSection";
import { StackRibbon } from "./StackRibbon";
import "./stack-machine.css";
import "./landing-page.css";

export default function LandingPage() {
  return (
    /*
     * `not-content` is Starlight's documented opt-out from prose styling, and
     * the landing needs it: rendering inside .sl-markdown-content meant
     * Starlight was applying its vertical rhythm to nested elements (a 16px
     * margin-top landed on a div inside the hero's install bar, making it 58px
     * tall and pushing the command out of line), forcing link colours over
     * Tailwind utilities, and styling every inline <code>. The landing owns its
     * own presentation entirely, so opting out is correct rather than a
     * workaround, and it removes three separate specificity fights.
     */
    <div className="bs-landing not-content overflow-hidden text-[var(--bs-text)]">
      <HeroSection />
      <StackRibbon />
      <GuardrailsSection />
      <StackFlowSection />
      <DocsGuide />
      <OpenSourceSection />
    </div>
  );
}
