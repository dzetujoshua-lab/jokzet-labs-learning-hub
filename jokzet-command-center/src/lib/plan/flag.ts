/**
 * Rollout switch for personalised learning. OFF unless the PERSONALISED_LEARNING environment variable is exactly "on".
 * While it is off nobody is sent to onboarding, new sign-ups get the original programme, and the onboarding page
 * redirects home. Turning it on is a separate, explicit decision (it is not part of any deployment by itself).
 */
export function personalisedLearningEnabled(): boolean {
  return process.env.PERSONALISED_LEARNING === "on";
}
