/*
 * The fade waits 300ms, so a quick load never flashes a card. Reduced
 * motion users get the state without the fade.
 */
export const PAGE_LOADING_FADE_CLASS_NAME =
  "motion-safe:animate-fade-in motion-safe:[animation-delay:300ms] motion-safe:[animation-fill-mode:both]";
