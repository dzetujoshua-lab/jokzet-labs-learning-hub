/**
 * Personalised learning is the default experience: every new account goes through onboarding (profile, programmes, goals,
 * experience, duration, availability) and gets a generated, reviewed plan. It is switched OFF only by setting the
 * PERSONALISED_LEARNING environment variable to "off" (an emergency opt-out that restores the original fixed programme for
 * NEW sign-ups). Existing learners are never moved between modes by this switch.
 */
export function personalisedLearningEnabled(): boolean {
  const v = (process.env.PERSONALISED_LEARNING ?? "").trim().toLowerCase();
  return !(v === "off" || v === "false" || v === "0");
}
