const SERVER_URL = import.meta.env.VITE_PUSH_SERVER_URL as string | undefined;
const ENABLED_KEY = "reminders-enabled";
const HOUR_KEY = "reminder-hour";

export type FocusSnapshot = { title: string; targetDate: string };

export function remindersAvailable() {
  return Boolean(
    SERVER_URL &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
  );
}

export function remindersOn() {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function reminderHour() {
  try {
    const raw = Number(localStorage.getItem(HOUR_KEY));
    return Number.isInteger(raw) && raw >= 0 && raw <= 23 ? raw : 8;
  } catch {
    return 8;
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function postSubscription(subscription: PushSubscription, focus: FocusSnapshot[]) {
  const res = await fetch(`${SERVER_URL}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      hour: reminderHour(),
      tzOffset: new Date().getTimezoneOffset(),
      tasks: focus,
    }),
  });
  if (!res.ok) throw new Error(`Reminder server returned ${res.status}`);
}

export async function enableReminders(focus: FocusSnapshot[]) {
  if (!remindersAvailable()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(await fetchPublicKey()),
    }));

  await postSubscription(subscription, focus);
  localStorage.setItem(ENABLED_KEY, "true");
  return true;
}

async function fetchPublicKey() {
  const res = await fetch(`${SERVER_URL}/vapid-public-key`);
  if (!res.ok) throw new Error(`Reminder server returned ${res.status}`);
  return (await res.text()).trim();
}

// Keeps the server's copy of the focus list current. Runs on every focus change
// while reminders are on; does nothing otherwise.
export async function syncReminders(focus: FocusSnapshot[]) {
  if (!remindersAvailable() || !remindersOn()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await postSubscription(subscription, focus);
}
