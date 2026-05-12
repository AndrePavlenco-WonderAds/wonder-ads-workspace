// Pure-CSS animated meteors. Each star streaks diagonally across the screen
// with a staggered delay so visually one appears roughly every ~3s.

const STARS = [
  { top: "10%", left: "85%", delay: "0s", duration: "2.8s" },
  { top: "22%", left: "62%", delay: "3s", duration: "3.2s" },
  { top: "8%", left: "40%", delay: "6s", duration: "2.6s" },
  { top: "35%", left: "78%", delay: "9s", duration: "3.4s" },
  { top: "18%", left: "20%", delay: "12s", duration: "3s" },
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
