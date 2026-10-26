// Focus Three reminder server. Stores each device's push subscription and its
// latest focus list, then sends one notification per day at the device's chosen hour.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = "mailto:you@example.com",
  ALLOWED_ORIGIN = "https://sai86nitt-glitch.github.io",
  PORT = "8787",
} = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (run: npm run keys).");
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const DATA_FILE = fileURLToPath(new URL("./data.json", import.meta.url));
const MAX_BODY = 16 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// endpoint -> { subscription, hour, tzOffset, tasks, lastSentDate }
let devices = existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, "utf8")) : {};

function save() {
  writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2));
}

// Local date and hour for a device, from the browser's getTimezoneOffset() (minutes, UTC minus local).
function localNow(tzOffset) {
  const local = new Date(Date.now() - tzOffset * 60000);
  return {
    date: local.toISOString().slice(0, 10),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

function daysBetween(fromDate, toDate) {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86400000);
}

function dueLabel(targetDate, today) {
  const diff = daysBetween(today, targetDate);
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  if (diff < 0) return `${-diff}d overdue`;
  return `due ${targetDate}`;
}

function buildMessage(tasks, today) {
  if (tasks.length === 0) {
    return { title: "Focus Three", body: "Nothing in focus today. Add a task or clear the backlog." };
  }
  return {
    title: "Your focus today",
    body: tasks.map((t, i) => `${i + 1}. ${t.title} (${dueLabel(t.targetDate, today)})`).join("\n"),
  };
}

async function sendDueReminders() {
  let changed = false;
  for (const [endpoint, device] of Object.entries(devices)) {
    const { date, hour, minute } = localNow(device.tzOffset);
    if (hour !== device.hour || minute !== 0 || device.lastSentDate === date) continue;

    try {
      await webpush.sendNotification(
        device.subscription,
        JSON.stringify(buildMessage(device.tasks, date))
      );
      device.lastSentDate = date;
      changed = true;
    } catch (err) {
      // 404/410 means the subscription is gone (app removed or permission revoked).
      if (err.statusCode === 404 || err.statusCode === 410) {
        delete devices[endpoint];
        changed = true;
      } else {
        console.error("Push failed:", err.statusCode ?? err.message);
      }
    }
  }
  if (changed) save();
}

function validSubscribe(body) {
  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://")) return false;
  if (typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string") return false;
  if (!Number.isInteger(body.hour) || body.hour < 0 || body.hour > 23) return false;
  if (!Number.isInteger(body.tzOffset) || Math.abs(body.tzOffset) > 840) return false;
  if (!Array.isArray(body.tasks) || body.tasks.length > 3) return false;
  return body.tasks.every(
    (t) =>
      t &&
      typeof t.title === "string" &&
      t.title.length <= 200 &&
      typeof t.targetDate === "string" &&
      DATE_RE.test(t.targetDate)
  );
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/vapid-public-key") {
      res.writeHead(200, { "Content-Type": "text/plain" }).end(VAPID_PUBLIC_KEY);
      return;
    }

    if (req.method === "POST" && req.url === "/subscribe") {
      const body = await readJson(req);
      if (!validSubscribe(body)) {
        res.writeHead(400).end("invalid subscription");
        return;
      }
      const previous = devices[body.subscription.endpoint];
      devices[body.subscription.endpoint] = {
        subscription: body.subscription,
        hour: body.hour,
        tzOffset: body.tzOffset,
        tasks: body.tasks,
        // Keep today's sent marker if the hour didn't change, so a re-sync doesn't resend.
        lastSentDate: previous && previous.hour === body.hour ? previous.lastSentDate : undefined,
      };
      save();
      res.writeHead(204).end();
      return;
    }

    if (req.method === "POST" && req.url === "/unsubscribe") {
      const body = await readJson(req);
      if (typeof body.endpoint === "string") {
        delete devices[body.endpoint];
        save();
      }
      res.writeHead(204).end();
      return;
    }

    res.writeHead(404).end();
  } catch {
    res.writeHead(400).end();
  }
});

server.listen(Number(PORT), () => {
  console.log(`Reminder server listening on ${PORT}`);
});

setInterval(sendDueReminders, 60_000);
