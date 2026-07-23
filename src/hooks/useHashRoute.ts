import { useEffect, useState } from "react";

export type AppRoute = "calendar" | "admin";

function getRouteFromHash(hash: string): AppRoute {
  return hash === "#/admin" ? "admin" : "calendar";
}

export function useHashRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() =>
    getRouteFromHash(window.location.hash),
  );

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return route;
}
