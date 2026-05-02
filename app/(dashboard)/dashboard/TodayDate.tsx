"use client";

import { useEffect, useState } from "react";

export function TodayDate() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      setLabel(
        new Intl.DateTimeFormat("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date())
      );
    }
    update();

    // Recalcula a medianoche para que cambie el día sin recargar
    const now = new Date();
    const msToMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
      now.getTime();
    const timeout = setTimeout(() => {
      update();
    }, msToMidnight);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <p className="text-sm text-muted mt-0.5 capitalize">{label}</p>
  );
}
