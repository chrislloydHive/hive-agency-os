"use client";

import { useEffect, useState } from "react";

export function TypedFindingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const speed = 15;

    const interval = setInterval(() => {
      setDisplayed((d) => d + text[i]);
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text]);

  return <span className="font-mono">{displayed}</span>;
}

