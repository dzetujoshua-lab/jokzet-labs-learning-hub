"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { sendTestNotificationAction, setBrowserEnabledAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { readPermission, type PermissionState } from "@/lib/notifications/permission";

const PERMISSION_TEXT: Record<PermissionState, string> = {
  granted: "Allowed",
  denied: "Blocked in the browser settings",
  default: "Not asked yet",
  unsupported: "Not supported by this browser",
};

const fail = (message: string): void => {
  toast.error(message);
};

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function BrowserNotifications({
  browserEnabled, pushConfigured, publicKey, subscriptionCount,
}: { browserEnabled: boolean; pushConfigured: boolean; publicKey: string | null; subscriptionCount: number }) {
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [subscribedHere, setSubscribedHere] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Read browser-only state after mount (it does not exist on the server).
    const id = requestAnimationFrame(async () => {
      setPermission(readPermission());
      const registration = await navigator.serviceWorker?.getRegistration();
      setSubscribedHere(Boolean(await registration?.pushManager?.getSubscription()));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /** Permission is requested ONLY here, in response to the user's click. */
  const enableBrowser = () =>
    startTransition(async () => {
      if (!("Notification" in window)) return fail("This browser does not support notifications.");
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await setBrowserEnabledAction(true);
        toast.success("Browser notifications enabled");
      } else {
        await setBrowserEnabledAction(false);
        toast.message("Browser notifications were not enabled. In-app reminders still work.");
      }
    });

  const disableBrowser = () =>
    startTransition(async () => {
      await setBrowserEnabledAction(false);
      toast.success("Browser notifications turned off");
    });

  const sendTest = () =>
    startTransition(async () => {
      await sendTestNotificationAction();
      window.dispatchEvent(new Event("jz:poll"));
    });

  const enablePush = () =>
    startTransition(async () => {
      try {
        if (!publicKey) return fail("Web Push is not configured on the server.");
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return fail("This browser does not support Web Push.");
        if (Notification.permission !== "granted") {
          const result = await Notification.requestPermission();
          setPermission(result);
          if (result !== "granted") return fail("Permission is needed for push notifications.");
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
        if (!response.ok) {
          await subscription.unsubscribe();
          return fail((await response.json().catch(() => null))?.error ?? "Could not save the push subscription.");
        }
        setSubscribedHere(true);
        toast.success("Background push enabled for this browser");
      } catch {
        toast.error("Could not enable push on this browser.");
      }
    });

  const disablePush = () =>
    startTransition(async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setSubscribedHere(false);
      toast.success("Background push turned off for this browser");
    });

  return (
    <section className="panel p-5 md:p-6">
      <p className="mono-label">Notifications</p>
      <h2 className="mt-2 font-display text-lg font-medium text-foreground">Browser notifications and push</h2>

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Browser permission</dt>
          <dd className="text-foreground">{PERMISSION_TEXT[permission]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Browser notifications</dt>
          <dd className="text-foreground">{browserEnabled && permission === "granted" ? "On (while the app is open)" : "Off"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Background push (browser closed)</dt>
          <dd className="text-foreground">{!pushConfigured ? "Not configured on the server" : subscribedHere ? "Subscribed on this browser" : "Not subscribed"}</dd>
        </div>
        {pushConfigured ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subscribed devices</dt>
            <dd className="text-foreground">{subscriptionCount}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {browserEnabled && permission === "granted" ? (
          <Button variant="secondary" size="sm" onClick={disableBrowser} disabled={pending}>
            Turn off browser notifications
          </Button>
        ) : (
          <Button size="sm" onClick={enableBrowser} disabled={pending || permission === "denied" || permission === "unsupported"}>
            Enable browser notifications
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={sendTest} disabled={pending}>
          Send test notification
        </Button>
        {pushConfigured ? (
          subscribedHere ? (
            <Button variant="secondary" size="sm" onClick={disablePush} disabled={pending}>
              Turn off background push
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={enablePush} disabled={pending || permission === "denied"}>
              Enable background push
            </Button>
          )
        ) : null}
      </div>

      <p className="mt-4 max-w-xl text-xs leading-relaxed text-muted-foreground">
        {permission === "denied"
          ? "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here. In-app reminders keep working."
          : "Browser notifications appear while the app is open. Reminders also show inside the app if browser notifications are off."}{" "}
        {pushConfigured
          ? "Background push needs a real push service to accept the subscription; the notification history shows whether each push was delivered."
          : "Background push (reminders when the browser is closed) is off until the server owner adds VAPID keys."}
      </p>
    </section>
  );
}
