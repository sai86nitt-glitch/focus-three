self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Focus Three", {
      body: data.body || "",
      icon: "/focus-three/pwa-192x192.png",
      tag: "focus-daily",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) =>
      windows.length > 0 ? windows[0].focus() : self.clients.openWindow("/focus-three/")
    )
  );
});
