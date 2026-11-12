"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { decideBrowserDelivery, readPermission } from "@/lib/notifications/permission";

type Pending = { deliveryId: string; channel: "IN_APP" | "BROWSER"; title: string; body: string; href: string; tag: string };

const POLL_MS = 30_000;

async function ack(deliveryId: string, status: "DELIVERED" | "SKIPPED" | "FAILED", error?: string) {
  await fetch("/api/notifications/ack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deliveryId, status, error }),
  }).catch(() => undefined);
}

async function showBrowserNotification(n: Pending) {
  const options = { body: n.body, tag: n.tag, data: { url: n.href }, icon: "/logo.png" };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(n.title, options);
  else new Notification(n.title, options);
}

/**
 * Runs while the app is open: every 30s (and when the tab regains focus) it asks the server to run one scheduler tick
 * and shows what is due. In-app reminders always show; browser notifications show only when permission is granted.
 * Delivery is acknowledged to the server so the same reminder is never shown twice (server dedupe + notification tag).
 */
export function ReminderRuntime() {
  const router = useRouter();
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/notifications/pending", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const { notifications } = (await response.json()) as { notifications: Pending[] };
        for (const n of notifications) {
          if (inFlight.current.has(n.deliveryId)) continue;
          inFlight.current.add(n.deliveryId);

          if (n.channel === "IN_APP") {
            toast(n.title, { description: n.body, duration: 12_000, action: { label: "Open", onClick: () => router.push(n.href) } });
            await ack(n.deliveryId, "DELIVERED");
          } else {
            const decision = decideBrowserDelivery(readPermission());
            if (decision.action === "show") {
              try {
                await showBrowserNotification(n);
                await ack(n.deliveryId, "DELIVERED");
              } catch {
                await ack(n.deliveryId, "FAILED", "The browser could not display the notification");
              }
            } else {
              await ack(n.deliveryId, "SKIPPED", decision.reason);
            }
          }
          router.refresh();
        }
      } catch {
        /* offline or signed out: try again on the next tick */
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    const onPollRequest = () => void poll(); // e.g. right after the user sends a test notification
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("jz:poll", onPollRequest);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("jz:poll", onPollRequest);
    };
  }, [router]);

  return null;
}
