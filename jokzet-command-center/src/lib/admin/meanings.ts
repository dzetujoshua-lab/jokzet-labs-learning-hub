/** What each short provider code means for the owner. Pure, so the browser can use it. Never a provider message. */
export const CHECK_MEANING: Record<string, string> = {
  AUTH: "The provider rejected the key. Check the key in the hosting settings.",
  BILLING: "The provider account has no credit or billing is not set up. Top it up with the provider.",
  RATE_LIMIT: "The provider is limiting requests right now. Try again later.",
  SERVER: "The provider had a server problem. Try again later.",
  TIMEOUT: "The provider did not answer in time.",
  NETWORK: "The provider could not be reached from the Academy's server.",
  INVALID_REQUEST: "The provider refused the request (for example an unknown model name). Check the model setting.",
  EMPTY: "The provider answered with nothing.",
  TRUNCATED: "The provider's answer was cut off.",
  NOT_CONFIGURED: "AI assessment is switched off or has no key.",
};
