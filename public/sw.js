self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      url: data.url || "/",
    },
  };

  const showNotification = self.registration.showNotification(
    data.title || "FC Help",
    options
  );

  const notifyOpenClients =
    data.playSound === false
      ? Promise.resolve([])
      : clients
          .matchAll({
            type: "window",
            includeUncontrolled: true,
          })
          .then((clientList) =>
            Promise.all(
              clientList.map((client) =>
                client.postMessage({
                  type: "FC_HELP_PUSH_SOUND",
                })
              )
            )
          );

  event.waitUntil(
    Promise.all([showNotification, notifyOpenClients])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification.data?.url || "/";

  event.waitUntil(
    clients.openWindow(url)
  );
});