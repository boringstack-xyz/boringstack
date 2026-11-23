import { resetJourneys } from "./fixtures/journeys";

/** Each run proves its own coverage: the previous run's record is dropped. */
export default function globalSetup(): void {
  resetJourneys();
}
