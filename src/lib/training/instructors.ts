// Quem dá a aula — do campo livre `presenter` para cartões de pessoa.
//
// O `presenter` no catálogo é texto ("Alice", "Alice / Alex", "Alice / Alex /
// André") porque é isso que se escreve no CMS sem pensar em ids. Aqui esse
// texto é partido e resolvido contra o elenco da casa, para a página de aula
// poder mostrar caras e cargos em vez de uma string.
//
// Um nome que não esteja no elenco NÃO é descartado: aparece na mesma, com
// avatar de iniciais. Um convidado externo continua a ser o instrutor daquela
// aula, e apagá-lo da UI só faria a página mentir.

export type TrainingInstructor = {
  /** Chave estável — usada no React key e no dedupe. */
  key: string;
  name: string;
  role: string;
  /** Foto em /public/team. null → avatar de iniciais. */
  photo: string | null;
  /** CSS object-position do crop circular. */
  objectPosition?: string;
};

/** Elenco conhecido, indexado pelas formas como aparece escrito no catálogo
 *  (sem acentos e em minúsculas — ver `normalizeKey`). */
const CAST: Record<string, TrainingInstructor> = {
  alice: {
    key: "alice",
    name: "Alice",
    role: "Co-fundadora · C-Level",
    photo: null,
  },
  alex: {
    key: "alex",
    name: "Alex",
    role: "Co-fundador · C-Level",
    photo: null,
  },
  andre: {
    key: "andre",
    name: "André Pavlenco",
    role: "COO · Head de SEO",
    photo: "/team/andre-pavlenco.jpg",
    objectPosition: "50% 20%",
  },
  "andre pavlenco": {
    key: "andre",
    name: "André Pavlenco",
    role: "COO · Head de SEO",
    photo: "/team/andre-pavlenco.jpg",
    objectPosition: "50% 20%",
  },
  germano: {
    key: "germano",
    name: "Germano Cunha",
    role: "Diretor DPT Publicidade",
    photo: "/team/germano-cunha.jpg",
    objectPosition: "50% 25%",
  },
  "germano c": {
    key: "germano",
    name: "Germano Cunha",
    role: "Diretor DPT Publicidade",
    photo: "/team/germano-cunha.jpg",
    objectPosition: "50% 25%",
  },
  "germano cunha": {
    key: "germano",
    name: "Germano Cunha",
    role: "Diretor DPT Publicidade",
    photo: "/team/germano-cunha.jpg",
    objectPosition: "50% 25%",
  },
};

/** Sem acentos, sem pontuação final, minúsculas — para que "André", "andre" e
 *  "Andre." resolvam todos para a mesma pessoa. */
function normalizeKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Iniciais para o avatar de quem não tem foto — no máximo duas letras. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** "Alice / Alex / André" → três instrutores, pela ordem escrita e sem
 *  repetidos. Aceita "/", "," e " e " como separadores. */
export function instructorsForPresenter(
  presenter: string | null | undefined,
): TrainingInstructor[] {
  if (!presenter) return [];
  const names = presenter
    .split(/\s*(?:\/|,|\se\s|&|\+)\s*/)
    .map((n) => n.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: TrainingInstructor[] = [];
  for (const name of names) {
    const known = CAST[normalizeKey(name)];
    const person: TrainingInstructor = known ?? {
      key: normalizeKey(name) || name,
      name,
      role: "Instrutor",
      photo: null,
    };
    if (seen.has(person.key)) continue;
    seen.add(person.key);
    out.push(person);
  }
  return out;
}
