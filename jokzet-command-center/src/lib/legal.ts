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
  /**
   * Privacy contact supplied by the owner. Override with PRIVACY_CONTACT_EMAIL. It is published as the contact address;
   * the page does not claim the mailbox has been verified.
   */
  privacyContactEmail: (process.env.PRIVACY_CONTACT_EMAIL?.trim() || "jokzetlabs.privacy@gmail.com") as string | null,
  /** Country the platform is operated from (provided by the owner). */
  country: "Ghana",
  /** Provided by the owner: an independently operated brand, not a registered company. */
  businessStatus: "an independently operated brand; it is not currently a registered company",
  /** Data-protection authority the owner named. */
  authorityName: "Ghana Data Protection Commission",
  authorityUrl: "https://dpc.gov.gh/",
  /** NOT PROVIDED YET: a postal address, if one should be published. */
  postalAddress: null as string | null,
} as const;

export const GOOGLE_USER_DATA_POLICY_URL = "https://developers.google.com/terms/api-services-user-data-policy";
export const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";
