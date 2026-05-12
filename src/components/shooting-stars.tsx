// Pure-CSS animated meteors. Each star streaks from upper-left toward the
// lower-right at a slight downward angle. Staggered delays so on average one
// becomes visible every ~3s.

const STARS = [
  { top: "4%", left: "8%", delay: "0s", duration: "2.6s" },
  { top: "14%", left: "22%", delay: "3s", duration: "3.0s" },
  { top: "6%", left: "38%", delay: "6s", duration: "2.8s" },
  { top: "22%", left: "5%", delay: "9s", duration: "3.4s" },
  { top: "10%", left: "52%", delay: "12s", duration: "3s" },
];

export function ShootingStars() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {STARS.map((s, i) => (
        <span
          key={i}
          className="shooting-star"
          style={{
            top: s.top,
            left: s.left,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  );
}
