// Who accompanies the client through onboarding, per track. SEO clients get
// their SEO lead; Ads clients get the Ads lead; combined clients see both.

export type TrackInstructor = {
  name: string;
  role: string;
  photo: string;
  /** CSS object-position for the circular avatar crop. */
  objectPosition: string;
};

export const TRACK_INSTRUCTORS: Record<"seo" | "ads", TrackInstructor> = {
  seo: {
    name: "André Pavlenco",
    role: "Instrutor · COO",
    photo: "/team/andre-pavlenco.jpg",
    objectPosition: "50% 20%",
  },
  ads: {
    name: "Germano Cunha",
    role: "Instrutor · Diretor DPT Publicidade",
    photo: "/team/germano-cunha.jpg",
    objectPosition: "50% 25%",
  },
};

/** Instructors for a set of active tracks, in order, de-duplicated. */
export function instructorsForTracks(
  tracks: ("seo" | "ads")[],
): TrackInstructor[] {
  const seen = new Set<string>();
  const out: TrackInstructor[] = [];
  for (const t of tracks) {
    const inst = TRACK_INSTRUCTORS[t];
    if (inst && !seen.has(inst.name)) {
      seen.add(inst.name);
      out.push(inst);
    }
  }
  return out;
}
