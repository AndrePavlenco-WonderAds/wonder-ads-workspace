// Instructor card(s) for the onboarding surfaces (light theme). Renders one
// row per active track's instructor (SEO → André, Ads → Germano).

import { instructorsForTracks } from "@/lib/onboarding-instructors";

export function OnboardingInstructors({
  tracks,
}: {
  tracks: ("seo" | "ads")[];
}) {
  const instructors = instructorsForTracks(tracks);
  if (instructors.length === 0) return null;

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        {instructors.map((i) => (
          <div key={i.name} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={i.photo}
              alt={i.name}
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-[#783DF5]/20"
              style={{ objectPosition: i.objectPosition }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-black/85">
                {i.name}
              </p>
              <p className="truncate text-[12px] text-black/45">{i.role}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-black/55">
        {instructors.length > 1
          ? "Estamos consigo em cada passo. Complete-os ao seu ritmo — o progresso fica guardado."
          : "Estou consigo em cada passo. Complete-os ao seu ritmo — o progresso fica guardado."}
      </p>
    </div>
  );
}
