export function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="starfield pointer-events-none absolute inset-0 z-0 opacity-50"
      />
      <div
        aria-hidden
        className="animate-drift-slow pointer-events-none absolute left-1/2 top-[-20%] z-0 h-[720px] w-[720px] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div
        aria-hidden
        className="animate-drift-slow pointer-events-none absolute -bottom-40 -left-32 z-0 h-[520px] w-[520px] rounded-full opacity-25 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(52,62,215,0.9), rgba(52,62,215,0) 70%)",
          animationDelay: "4s",
        }}
      />
      <div
        aria-hidden
        className="animate-drift-slow pointer-events-none absolute -bottom-32 -right-32 z-0 h-[520px] w-[520px] rounded-full opacity-25 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(197,53,201,0.9), rgba(197,53,201,0) 70%)",
          animationDelay: "8s",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(7,8,13,0.4)_70%,rgba(7,8,13,0.95)_100%)]"
      />
    </>
  );
}
