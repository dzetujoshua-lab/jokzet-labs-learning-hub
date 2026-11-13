/**
 * Facts the Privacy Policy page needs that are NOT in the code and must come from the owner. Nothing here is invented: a value
 * that has not been provided is `null`, and the page says so plainly instead of showing a guess. Fill these in (they are the
 * only places to edit) before the page is relied on for anything official, such as a Google OAuth verification.
 */
export const LEGAL = {
  /** The brand shown in the app. */
  siteName: "JOKZET Labs",
  productName: "JOKZET Labs Learning Command Center",
  siteUrl: "https://jokzet-labs-command-center.netlify.app",

  /** Date the policy text was last reviewed against the app's real behaviour (ISO). Change it when the text changes. */
  lastUpdated: "2026-11-13",

  /** NOT PROVIDED YET: the legal name of whoever operates the platform (person or company). */
  operatorLegalName: null as string | null,
  /** NOT PROVIDED YET: the email address people should use for privacy questions and requests. */
  privacyContactEmail: null as string | null,
  /** NOT PROVIDED YET: a postal address, if one should be published. */
  postalAddress: null as string | null,
} as const;

export const GOOGLE_USER_DATA_POLICY_URL = "https://developers.google.com/terms/api-services-user-data-policy";
export const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";
