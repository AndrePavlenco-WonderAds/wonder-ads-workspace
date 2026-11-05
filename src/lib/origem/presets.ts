// Origem de Pacientes — as peças repetidas entre clientes (v78.76): as
// origens, os canais e as palavras de cada tipo de negócio.
//
// CORES DAS ORIGENS. Cada origem tem sempre a mesma cor, em todos os
// clientes (o Google é sempre o mesmo azul-petróleo, a IA o mesmo violeta).
// São as da MyMedic, validadas com o validador da skill de dataviz para fundo
// branco; as origens novas (guia, publicidade, prova, frota) ocupam lugares
// que esses clientes não usam. Cada lista abaixo foi validada NA SUA ORDEM
// (pares vizinhos: daltonismo ≥ 10 ΔE, visão normal ≥ 15 ΔE) — a ordem da
// lista é a da barra dos relatórios, por isso não se troca sem voltar a
// validar. O cinzento de «Outra» é cinzento de propósito.

import type { OrigemChannel, OrigemPlace, OrigemSource } from "./config";

const C = {
  google: "#2A9DB5",
  ia: "#7B5CF2",
  redes: "#CC4FB4",
  recomendacao: "#97A21B",
  medico: "#3F5FC8",
  porta: "#E58A3B",
  outro: "#9AA5A6",
  guias: "#3F5FC8",
  publicidade: "#3F5FC8",
  evento: "#008300",
  frota: "#EDA100",
} as const;

const google = (hint = "Pesquisa ou Google Maps"): OrigemSource => ({ id: "google", label: "Google", hint, color: C.google, search: true });
const ia: OrigemSource = { id: "ia", label: "ChatGPT ou outra IA", hint: "Gemini, Copilot, Perplexity…", color: C.ia, search: true };
const redes = (hint = "Facebook, Instagram…"): OrigemSource => ({ id: "redes", label: "Redes sociais", hint, color: C.redes });
const recomendacao = (hint: string): OrigemSource => ({ id: "recomendacao", label: "Recomendação", hint, color: C.recomendacao });
const medico = (hint: string, label = "Médico ou seguro"): OrigemSource => ({ id: "medico", label, hint, color: C.medico });
const porta = (hint: string): OrigemSource => ({ id: "porta", label: "Passagem à porta", hint, color: C.porta });
const outro = (hint = "Rádio, jornal, evento…"): OrigemSource => ({ id: "outro", label: "Outra", hint, color: C.outro });

/** Clínicas: a lista da MyMedic (validada nesta ordem). */
export function clinicSources(o: { recomendacao?: string; medico?: string; medicoLabel?: string; porta?: string } = {}): OrigemSource[] {
  return [
    google(),
    ia,
    redes(),
    recomendacao(o.recomendacao ?? "Família, amigos, outro paciente"),
    medico(o.medico ?? "Encaminhado, Médis, ADSE…", o.medicoLabel),
    porta(o.porta ?? "Viu a clínica na rua"),
    outro(),
  ];
}

/** Clínicas a que ninguém chega por passar à porta (cirurgia, ortóteses). */
export function referralClinicSources(o: { recomendacao?: string; medico: string; medicoLabel?: string }): OrigemSource[] {
  return [
    google(),
    ia,
    redes(),
    recomendacao(o.recomendacao ?? "Família, amigos, outro paciente"),
    medico(o.medico, o.medicoLabel),
    outro(),
  ];
}

/** Salões de cabeleireiro. */
export function salonSources(): OrigemSource[] {
  return [
    google(),
    ia,
    recomendacao("Família, amigos, outro cliente"),
    redes("Instagram, Facebook, TikTok…"),
    porta("Viu o salão no centro comercial ou na rua"),
    outro("Campanha, oferta, evento…"),
  ];
}

/** Restaurantes. */
export function restaurantSources(): OrigemSource[] {
  return [
    google(),
    ia,
    recomendacao("Amigos, família, o hotel ou o concierge"),
    redes("Instagram, Facebook…"),
    porta("Viu o restaurante e entrou"),
    { id: "guias", label: "Guia ou plataforma", hint: "TheFork, TripAdvisor, Michelin…", color: C.guias },
    outro("Imprensa, evento…"),
  ];
}

/** Provas de corrida (inscrições). */
export function raceSources(): OrigemSource[] {
  return [
    google(),
    ia,
    recomendacao("Amigos, clube, outro atleta"),
    redes("Instagram, Facebook, Strava…"),
    { id: "evento", label: "Outra prova ou feira", hint: "Expo, corrida, evento desportivo…", color: C.evento },
    { id: "publicidade", label: "Publicidade", hint: "Outdoor, rádio, TV, imprensa…", color: C.publicidade },
    outro("Patrocinador, empresa…"),
  ];
}

/** Estafetas e logística (clientes que pedem orçamento). */
export function courierSources(): OrigemSource[] {
  return [
    google(),
    ia,
    recomendacao("Outra empresa, um cliente, um conhecido"),
    redes("LinkedIn, Facebook, Instagram…"),
    { id: "frota", label: "Viu a nossa frota", hint: "Uma mota ou carrinha na rua", color: C.frota },
    outro("Feira, imprensa…"),
  ];
}

/** Os canais da receção (os da MyMedic). */
export const DESK_CHANNELS: OrigemChannel[] = [
  { id: "telefone", label: "Telefone", phrase: "por telefone" },
  { id: "whatsapp", label: "WhatsApp", phrase: "por WhatsApp" },
  { id: "balcao", label: "Ao balcão", phrase: "ao balcão" },
  { id: "online", label: "Site ou email", phrase: "pelo site ou email" },
];

export const RESTAURANT_CHANNELS: OrigemChannel[] = [
  { id: "telefone", label: "Telefone", phrase: "por telefone" },
  { id: "online", label: "Reserva online", phrase: "com reserva online" },
  { id: "whatsapp", label: "WhatsApp", phrase: "por WhatsApp" },
  { id: "balcao", label: "À porta", phrase: "à porta, sem reserva" },
];

export const RACE_CHANNELS: OrigemChannel[] = [
  { id: "online", label: "Inscrição online", phrase: "na inscrição online" },
  { id: "balcao", label: "Presencial", phrase: "presencialmente" },
  { id: "telefone", label: "Telefone", phrase: "por telefone" },
  { id: "email", label: "Email", phrase: "por email" },
];

export const COURIER_CHANNELS: OrigemChannel[] = [
  { id: "telefone", label: "Telefone", phrase: "por telefone" },
  { id: "online", label: "Orçamento no site", phrase: "pelo pedido de orçamento" },
  { id: "email", label: "Email", phrase: "por email" },
  { id: "whatsapp", label: "WhatsApp", phrase: "por WhatsApp" },
];

export const PACIENTE = { one: "paciente", many: "pacientes" };
export const CLIENTE = { one: "cliente", many: "clientes" };
export const ATLETA = { one: "atleta", many: "atletas" };

export const CLINICA: OrigemPlace = { one: "clínica", many: "clínicas", the: "a clínica", inThis: "nesta clínica", gender: "f", param: "clinica" };
export const LOJA: OrigemPlace = { one: "loja", many: "lojas", the: "a loja", inThis: "nesta loja", gender: "f", param: "loja" };
export const SALAO: OrigemPlace = { one: "salão", many: "salões", the: "o salão", inThis: "neste salão", gender: "m", param: "salao" };
export const RESTAURANTE: OrigemPlace = {
  one: "restaurante",
  many: "restaurantes",
  the: "o restaurante",
  inThis: "neste restaurante",
  gender: "m",
  param: "restaurante",
};
/** Um cliente sem locais para escolher (o registo é da equipa toda). */
export const LOCAL: OrigemPlace = { one: "local", many: "locais", the: "o local", inThis: "neste local", gender: "m", param: "local" };

export const RECECAO = { who: "a receção", of: "da receção", at: "na receção" };
export const NA_LOJA = { who: "a loja", of: "da loja", at: "na loja" };
export const EQUIPA = { who: "a equipa", of: "da equipa", at: "pela equipa" };
