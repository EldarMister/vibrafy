import { useEffect, useState } from "react";

export function useTelegram() {
  const [webApp, setWebApp] = useState(null);

  useEffect(() => {
    const app = window.Telegram?.WebApp ?? null;

    if (!app) {
      return;
    }

    app.ready();
    app.expand();
    setWebApp(app);
  }, []);

  return webApp;
}

