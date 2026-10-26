// Retrato redondo de public/team, ou a inicial quando não há.

/* eslint-disable @next/next/no-img-element */
export function Avatar({
  name,
  src,
  size = 28,
  ring = false,
}: {
  name: string;
  src: string | null;
  size?: number;
  /** Contorno escuro — para retratos empilhados uns sobre os outros. */
  ring?: boolean;
}) {
  const cls = `shrink-0 rounded-full object-cover ${ring ? "ring-2 ring-[#07080d]" : ""}`;
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className={cls} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-label={name}
      className={`${cls} flex items-center justify-center bg-[#783DF5]/30 font-semibold text-white`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
