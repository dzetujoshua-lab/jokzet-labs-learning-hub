/**
 * What to do with a BROWSER delivery given the browser's Notification permission.
 * Pure so it is unit-tested; the client runtime calls it for every pending delivery.
 * Denied/undecided never blocks the in-app reminder: that channel is independent.
 */
export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function decideBrowserDelivery(permission: PermissionState): { action: "show" } | { action: "skip"; reason: string } {
  switch (permission) {
    case "granted":
      return { action: "show" };
    case "denied":
      return { action: "skip", reason: "Browser notification permission was denied" };
    case "default":
      return { action: "skip", reason: "Browser notification permission has not been granted" };
    default:
      return { action: "skip", reason: "This browser does not support notifications" };
  }
}

export function readPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
