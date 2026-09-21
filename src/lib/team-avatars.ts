// Retratos da equipa (public/team/avatar/*, 300×400, cabeça a ~40% da
// altura — ver scripts/crop-team-avatars.py) resolvidos por username de
// login. Usados no círculo do utilizador no header e na lista «Ver como…»
// do SuperAdmin (v76.88). A board de SEO fica SEM fotos, por decisão do
// André — os cabeçalhos das colunas mantêm só o nome.
//
// Quem não tem retrato publicado (Hugo Silva, por agora) devolve null e a UI
// cai na inicial, como no formulário de NPS. Manuel Silva ganhou o dele na
// v77.40.

const AVATARS: Record<string, string> = {
  andre: "/team/avatar/andre.jpg",
  alex: "/team/avatar/alex.jpg",
  alice: "/team/avatar/alice.jpg",
  "fran-r": "/team/avatar/fran-r.jpg",
  "andre-pereira": "/team/avatar/andre-pereira.jpg",
  "joao-b": "/team/avatar/joao-b.jpg",
  "germano-c": "/team/avatar/germano-c.jpg",
  mike: "/team/avatar/mike.jpg",
  gustavo: "/team/avatar/gustavo.jpg",
  renan: "/team/avatar/renan.jpg",
  cylas: "/team/avatar/cylas.jpg",
  "manuel-s": "/team/avatar/manuel-s.jpg",
};

/** Caminho do retrato para um username de login, ou null se não há foto. */
export function getTeamAvatar(username: string | null | undefined): string | null {
  if (!username) return null;
  return AVATARS[username.toLowerCase()] ?? null;
}
