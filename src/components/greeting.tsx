"use client";

import { useEffect, useState } from "react";

/** Time-of-day greeting using the VIEWER's local clock (so a consultant
 *  in Lisbon and one elsewhere each get the right "Good Morning/Afternoon/
 *  Evening"). Renders on the client to read real local time; before mount
 *  it shows a neutral default to avoid a hydration mismatch. */
export function Greeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState<string>("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening",
    );
  }, []);
  return (
    <>
      {greeting}, {name}
    </>
  );
}
