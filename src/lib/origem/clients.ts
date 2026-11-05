// Origem de Pacientes — os clientes com página (/<slug>/origem).
//
// v78.68 piloto MyMedic; v78.76 todos os clientes de SEO ativos, cada um com
// a sua marca: as cores, a letra, o logótipo e os cantos do site dele (os
// tokens foram tirados do CSS e das capturas de cada site e verificados para
// contraste — texto ≥ 4,5:1). Ficam de fora a WonderAds, os clientes
// pausados no SEO DPT e os que o André excluiu (Kings Gyms, InSync, IHN,
// HDS).
//
// Os locais vêm das páginas de contactos/lojas de cada site (05/11/2026).
// Os `id` de locais são a chave dos registos: nunca se mudam depois de haver
// dados (o nome pode mudar à vontade).

import type { OrigemClient } from "./config";
import {
  ATLETA,
  CLIENTE,
  CLINICA,
  COURIER_CHANNELS,
  DESK_CHANNELS,
  EQUIPA,
  LOCAL,
  LOJA,
  NA_LOJA,
  PACIENTE,
  RACE_CHANNELS,
  RECECAO,
  RESTAURANTE,
  RESTAURANT_CHANNELS,
  SALAO,
  clinicSources,
  courierSources,
  raceSources,
  referralClinicSources,
  restaurantSources,
  salonSources,
} from "./presets";

const START = "2026-11-05";
const mark = (slug: string, ext = "png") => ({ src: `/origem/${slug}/mark.${ext}` });
const logo = (slug: string, h: number, ext = "png") => ({ src: `/origem/${slug}/logo.${ext}`, h });

const MYMEDIC: OrigemClient = {
  slug: "mymedic",
  brand: "MyMedic Clínicas",
  brandShort: "MyMedic",
  brandOf: "da MyMedic",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  // As duas clínicas de mymedic.pt/contactos (03/11/2026).
  sites: [
    { id: "viseu", name: "Clínica de Viseu", short: "Viseu", address: ["Rua João Mendes, 143", "3500-142 Viseu"] },
    {
      id: "fornos",
      name: "Clínica de Fornos de Algodres",
      short: "Fornos de Algodres",
      address: ["Estrada Nacional 16, n.º 131", "6370-148 Fornos de Algodres"],
    },
  ],
  sources: clinicSources(),
  channels: DESK_CHANNELS,
  startDay: "2026-11-03",
  // As cores de mymedic.pt (teal #5ABDCA, lima #CAD225, texto #173435).
  theme: {
    paper: "#F3F9F9",
    ink: "#173435",
    muted: "#5E7576",
    line: "#DCEBEC",
    primary: "#5ABDCA",
    deep: "#2E7280",
    accent: "#CAD225",
    mark: "mymedic-cross",
    font: "manrope",
  },
};

// aegerprima.pt — laranja #EF8722 e roxo #573996, Montserrat.
const AEGER_PRIMA: OrigemClient = {
  slug: "aeger-prima",
  brand: "Clínica Aeger Prima",
  brandShort: "Aeger Prima",
  brandOf: "da Aeger Prima",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [{ id: "lisboa", name: "Clínica Aeger Prima", short: "Lisboa", address: ["Rua Mãe de Água, 15 B", "1250-154 Lisboa"] }],
  sources: clinicSources(),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#FEF6F0",
    ink: "#2B1D4C",
    muted: "#6F6B80",
    line: "#F2E2D6",
    primary: "#EF8722",
    deep: "#573996",
    accent: "#F39A3D",
    mark: mark("aeger-prima"),
    font: "montserrat",
  },
  logo: logo("aeger-prima", 46),
};

// b-life.clinic — creme, verde-escuro #03261D e o terracota das imagens; DM Sans fina.
const B_LIFE: OrigemClient = {
  slug: "b-life",
  brand: "B-Life Clinic",
  brandShort: "B-Life",
  brandOf: "da B-Life",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [{ id: "cascais", name: "B-Life Clinic", short: "Cascais", address: ["Marina de Cascais", "2750-800 Cascais"] }],
  sources: clinicSources({ porta: "Viu a clínica na Marina" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F5F1EA",
    ink: "#03261D",
    muted: "#576F67",
    line: "#E5DED2",
    primary: "#2C6A56",
    deep: "#0D4434",
    accent: "#E3714A",
    mark: mark("b-life"),
    font: "dmSans",
    heading: 500,
  },
  logo: logo("b-life", 30),
};

// mimus.pt — o rosa do logótipo, o turquesa #3EC7C5 e o coral #FF8A8B; Montserrat.
const MIMUS: OrigemClient = {
  slug: "clinica-mimus",
  brand: "Clínica Mimus",
  brandShort: "Mimus",
  brandOf: "da Mimus",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "ermesinde",
      name: "Clínica Mimus",
      short: "Ermesinde",
      address: ["Rua José Joaquim Ribeiro Teles, n.º 290", "4445-485 Ermesinde"],
    },
  ],
  sources: clinicSources({ medico: "Encaminhado, Médis, Multicare…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F0FAF9",
    ink: "#203A40",
    muted: "#577177",
    line: "#D7EAE9",
    primary: "#3EC7C5",
    deep: "#137775",
    accent: "#FF8A8B",
    mark: mark("clinica-mimus"),
    font: "montserrat",
  },
  logo: logo("clinica-mimus", 46),
};

// spinecenter.pt — azul #175F95 e o anel azul-claro; Raleway. Cirurgia da
// coluna: ninguém chega por passar à porta.
const SPINE_CENTER: OrigemClient = {
  slug: "spine-center",
  brand: "Spine Center",
  brandShort: "Spine Center",
  brandOf: "do Spine Center",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "coimbra",
      name: "Spine Center Coimbra",
      short: "Coimbra",
      address: ["Edifício Diaton, Piso 3, Calçada do Gato, Lote 2", "3000-199 Coimbra"],
    },
    { id: "guarda", name: "Spine Center Guarda", short: "Guarda", address: ["Egiclínica, Rua Calouste Gulbenkian, B3", "6300-670 Guarda"] },
    {
      id: "funchal",
      name: "Spine Center Funchal",
      short: "Funchal",
      address: ["Clínica Médica da Ajuda, Rua Nova do Vale da Ajuda, 16", "9000-720 Funchal"],
    },
  ],
  sources: referralClinicSources({ medico: "Encaminhado por um médico, Médis, ADSE…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F2F8FE",
    ink: "#0C2337",
    muted: "#5D6E7E",
    line: "#DAE7F2",
    primary: "#2C86C2",
    deep: "#175F95",
    accent: "#6CB8E8",
    mark: mark("spine-center"),
    font: "raleway",
    shape: "soft",
  },
  logo: logo("spine-center", 42),
};

// montemar.pt — preto, o azul-mar #7FA8AD e o aqua #8ECFD7; Josefin Sans, cantos retos.
const MONTE_MAR: OrigemClient = {
  slug: "monte-mar",
  brand: "Monte Mar",
  brandShort: "Monte Mar",
  brandOf: "do Monte Mar",
  person: CLIENTE,
  place: RESTAURANTE,
  desk: EQUIPA,
  // Os três restaurantes com reserva em montemar.pt (o balcão do Time Out
  // Market fica de fora: não há reservas nem receção).
  sites: [
    { id: "cascais", name: "Monte Mar Cascais", short: "Cascais", address: ["Avenida Nossa Senhora do Cabo", "2750-004 Guincho, Cascais"] },
    {
      id: "lisboa",
      name: "Monte Mar Lisboa",
      short: "Lisboa",
      address: ["Rua da Cintura do Porto de Lisboa, Armazém 65", "1200-109 Lisboa"],
    },
    { id: "lagos", name: "Monte Mar Lagos", short: "Lagos" },
  ],
  sources: restaurantSources(),
  channels: RESTAURANT_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F6F4EF",
    ink: "#1C1C1A",
    muted: "#66655F",
    line: "#E6E2D9",
    primary: "#7FA8AD",
    deep: "#3F6D73",
    accent: "#8ECFD7",
    mark: mark("monte-mar", "svg"),
    font: "josefin",
    heading: 600,
    shape: "square",
  },
  logo: logo("monte-mar", 34, "svg"),
};

// corridadotempo.pt — âmbar #F6A800 e cinza-carvão; Exo 2 (a letra do site),
// cantos retos. Estafetas e logística: quem regista é a equipa comercial.
const CDT: OrigemClient = {
  slug: "cdt",
  brand: "Corrida do Tempo",
  brandShort: "CDT",
  brandOf: "da CDT",
  person: CLIENTE,
  place: LOCAL,
  desk: EQUIPA,
  sites: [{ id: "geral", name: "Corrida do Tempo", short: "CDT" }],
  sources: courierSources(),
  channels: COURIER_CHANNELS,
  startDay: START,
  theme: {
    paper: "#FAF8F3",
    ink: "#232322",
    muted: "#6B6A66",
    line: "#ECE6D8",
    primary: "#F6A800",
    deep: "#3A3A37",
    accent: "#F9B600",
    mark: mark("cdt"),
    font: "exo2",
    shape: "square",
  },
  logo: logo("cdt", 54),
};

// whiteclinic.pt — verde-escuro #0F341F e dourado #AE895D; Inter.
const WHITE_CLINIC: OrigemClient = {
  slug: "white-clinic",
  brand: "White Clinic",
  brandShort: "White Clinic",
  brandOf: "da White Clinic",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "miraflores",
      name: "White Clinic",
      short: "Miraflores",
      address: ["Rua Dr. António Loureiro Borges, Ed. 5, 1.º A", "1495-131 Miraflores, Algés"],
    },
  ],
  sources: clinicSources({ medico: "Encaminhado, Médis, Multicare…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F6F4EF",
    ink: "#0F341F",
    muted: "#56625A",
    line: "#E7E1D6",
    primary: "#AE895D",
    deep: "#24533A",
    accent: "#C9A475",
    mark: "check",
    font: "inter",
    heading: 600,
    shape: "soft",
  },
  logo: logo("white-clinic", 40),
};

// sentirsaude.pt — azul-marinho #001842 e o azul do «S»; Manrope (a do site).
const SENTIR_SAUDE: OrigemClient = {
  slug: "sentir-saude",
  brand: "Sentir Saúde",
  brandShort: "Sentir Saúde",
  brandOf: "da Sentir Saúde",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "vila-do-conde",
      name: "Sentir Saúde Vila do Conde",
      short: "Vila do Conde",
      address: ["Avenida de Portas Fronhas, 300", "4480-004 Vila do Conde"],
    },
    {
      id: "rates",
      name: "Sentir Saúde Rates",
      short: "Rates",
      address: ["Centro Social de S. Pedro de Rates", "4570-491 Rates, Póvoa de Varzim"],
    },
  ],
  sources: clinicSources({ medico: "Médico, ortopedista, Médis, ADSE…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F2F8FE",
    ink: "#001842",
    muted: "#616D7F",
    line: "#DBE7F2",
    primary: "#1C7DC0",
    deep: "#123966",
    accent: "#2FB2F0",
    mark: mark("sentir-saude"),
    font: "manrope",
  },
  logo: logo("sentir-saude", 34),
};

// clinicasdentariasfa.pt — o logótipo multicolor (laranja, rosa, verde) sobre
// carvão #2B2B2D; DM Sans.
const FERNANDO_ALMEIDA: OrigemClient = {
  slug: "clinica-fernando-almeida",
  brand: "Clínicas Dentárias FA",
  brandShort: "FA",
  brandOf: "das Clínicas FA",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "gaia",
      name: "Clínica Prof. Dr. Fernando Almeida",
      short: "Gaia",
      address: ["Rua Gonçalves de Castro, 118", "4415-376 Pedroso, Vila Nova de Gaia"],
    },
    {
      id: "lisboa",
      name: "Clínica Infante Sagres",
      short: "Lisboa",
      address: ["Rua Luís Braille, lote A3, R/C Loja B", "1400-031 Lisboa"],
    },
  ],
  sources: clinicSources({ medico: "Encaminhado, Médis, Multicare…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F8F7F4",
    ink: "#2B2B2D",
    muted: "#69686C",
    line: "#E9E6E0",
    primary: "#F58320",
    deep: "#B23A72",
    accent: "#4EB848",
    mark: mark("clinica-fernando-almeida"),
    font: "dmSans",
  },
  logo: logo("clinica-fernando-almeida", 34),
};

// cidalia-cabeleireiros.com — o preto do logótipo e o verde-água do site;
// Jost (perto da Metrocity do site), cantos retos. Os 13 salões e o showroom
// de cidalia-cabeleireiros.com/pt/rede-de-lojas (as mesmas fichas do Reviews Hub).
const CIDALIA: OrigemClient = {
  slug: "cidalia-cabeleireiros",
  brand: "Cidália Cabeleireiros",
  brandShort: "Cidália",
  brandOf: "da Cidália",
  person: CLIENTE,
  place: SALAO,
  desk: RECECAO,
  sites: [
    { id: "alameda", name: "Alameda Shop & Spot", short: "Alameda", address: ["Rua dos Campeões Europeus, 28, Lojas 319-320", "4350-414 Porto"] },
    { id: "alegro-setubal", name: "Alegro Setúbal", short: "Alegro Setúbal", address: ["Avenida Antero de Quental, 2, Loja 0.011A", "2910-394 Setúbal"] },
    { id: "alegro-sintra", name: "Alegro Sintra", short: "Alegro Sintra", address: ["IC19, Rio de Mouro, Loja 0.89", "2635-018 Sintra"] },
    { id: "alma", name: "Alma Shopping", short: "Alma Shopping", address: ["Rua General Humberto Delgado, 207-211, Loja 009", "3030-327 Coimbra"] },
    { id: "almada", name: "Almada", short: "Almada", address: ["Praça São João Baptista, 5-C, Loja Q", "2800-199 Almada"] },
    { id: "barreiro", name: "Barreiro Retail Planet", short: "Barreiro", address: ["Estrada Nacional 10, km 18,5, Loja 26", "2830-411 Coina"] },
    { id: "colombo", name: "C.C. Colombo", short: "Colombo", address: ["Avenida Lusíada, Lojas 0.65-0.66", "1500-392 Lisboa"] },
    { id: "mbica", name: "C.C. M. Bica", short: "M. Bica", address: ["Rua Garcia de Orta, n.º 26, Lojas 37-38", "2800-698 Almada"] },
    { id: "cova-piedade", name: "Cova da Piedade", short: "Cova da Piedade", address: ["Avenida da Fundação, n.º 11A", "2805-152 Almada"] },
    { id: "entrecampos", name: "Entrecampos", short: "Entrecampos", address: ["Rua Julieta Ferrão, Lotes B-C, Loja 2", "1600-131 Lisboa"] },
    { id: "evora", name: "Évora Plaza", short: "Évora", address: ["Rua Luís Adelino Fonseca, 2, Loja 0.30DA", "7005-345 Évora"] },
    { id: "miguel-bombarda", name: "Miguel Bombarda", short: "Miguel Bombarda", address: ["Avenida Miguel Bombarda, 95A, Loja 1", "1050-162 Lisboa"] },
    { id: "parque-nascente", name: "Parque Nascente", short: "Parque Nascente", address: ["Praceta Parque Nascente, 35, Piso 1, Loja 408", "4435-182 Rio Tinto"] },
    { id: "showroom", name: "Showroom Seixal", short: "Showroom", address: ["Rua Quinta das Rosas, 44, Lote 19", "2840-131 Aldeia de Paio Pires"] },
  ],
  sources: salonSources(),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F7F6F4",
    ink: "#0B0D0D",
    muted: "#6A6762",
    line: "#E7E4DF",
    primary: "#10A898",
    deep: "#0B7A6E",
    accent: "#2CC0AE",
    mark: "check",
    font: "jost",
    shape: "square",
  },
  logo: logo("cidalia-cabeleireiros", 42),
};

// maratonaclubedeportugal.com — azul-marinho #053266 e o verde-néon #28FF52;
// Oswald nos títulos e números (o das provas), Nunito Sans no resto.
const MARATONA: OrigemClient = {
  slug: "maratona-clube-de-portugal",
  brand: "Maratona Clube de Portugal",
  brandShort: "Maratona",
  brandOf: "do Maratona Clube de Portugal",
  person: ATLETA,
  place: LOCAL,
  desk: EQUIPA,
  sites: [{ id: "geral", name: "Maratona Clube de Portugal", short: "Maratona" }],
  sources: raceSources(),
  channels: RACE_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F3F8FE",
    ink: "#06203F",
    muted: "#606D7E",
    line: "#DDE6F3",
    primary: "#053266",
    deep: "#053266",
    accent: "#28FF52",
    mark: mark("maratona-clube-de-portugal"),
    font: "nunitoSans",
    display: "oswald",
    heading: 600,
    shape: "square",
  },
  logo: logo("maratona-clube-de-portugal", 42),
};

// physiohub.pt — o azul do site #3CB4E4; Poppins. As 7 clínicas e os 3
// departamentos de fisioterapia dos hospitais CUF (physiohub.pt/contactos).
const PHYSIOHUB: OrigemClient = {
  slug: "physio-hub",
  brand: "PhysioHub",
  brandShort: "PhysioHub",
  brandOf: "da PhysioHub",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    { id: "almada", name: "PhysioHub Almada", short: "Almada", address: ["Rua D. Sancho I, n.º 17", "2800-712 Almada"] },
    { id: "amadora", name: "PhysioHub Amadora", short: "Amadora", address: ["Rua Alfredo Keil, 8", "2700-036 Amadora"] },
    { id: "estoril", name: "PhysioHub Estoril", short: "Estoril", address: ["Avenida Bombeiros Voluntários, n.º 89", "2765-202 Estoril"] },
    { id: "expo", name: "PhysioHub Expo", short: "Expo", address: ["Edifício Adamastor, Av. D. João II, n.º 9 J", "Parque das Nações, Lisboa"] },
    { id: "faro", name: "PhysioHub Faro", short: "Faro", address: ["Faro Shopping, Av. Dr. Gordinho Moreira", "8005-145 Faro"] },
    {
      id: "marques",
      name: "PhysioHub Marquês de Pombal",
      short: "Marquês de Pombal",
      address: ["Edifício Castil, Rua Castilho, n.º 39, Piso 7, Loja 32", "1250-068 Lisboa"],
    },
    { id: "sintra", name: "PhysioHub Sintra", short: "Sintra" },
    { id: "cuf-cascais", name: "CUF Cascais", short: "CUF Cascais", address: ["Rua Fernão Lopes, n.º 60, Piso -1", "2750-663 Cascais"] },
    { id: "cuf-tejo", name: "CUF Tejo", short: "CUF Tejo", address: ["Av. 24 de Julho, n.º 171, Piso -1", "1350-352 Lisboa"] },
    { id: "cuf-acores", name: "CUF Açores", short: "CUF Açores", address: ["Alameda do Conhecimento, 3", "9560-421 Lagoa, Açores"] },
  ],
  sources: clinicSources({ medico: "Médico, ortopedista, CUF, Médis…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F1F9FD",
    ink: "#0D2B3E",
    muted: "#5B6F7D",
    line: "#D8E8F0",
    primary: "#3CB4E4",
    deep: "#1B6F9C",
    accent: "#3CB4E4",
    mark: mark("physio-hub"),
    font: "poppins",
    heading: 700,
  },
  logo: logo("physio-hub", 36),
};

// atnmedical.pt — os azuis do logótipo (#00B2F4, #0073A3); Inter (a mais
// próxima da Neue Haas do site). Ortóteses STARband: chegam pelo pediatra.
const ATN_MEDICAL: OrigemClient = {
  slug: "atn-medical",
  brand: "ATN Medical",
  brandShort: "ATN Medical",
  brandOf: "da ATN Medical",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    { id: "braga", name: "ATN Medical Braga", short: "Braga", address: ["Rua Dr. Francisco Duarte, 313", "4715-017 Braga"] },
    { id: "lisboa", name: "ATN Medical Lisboa", short: "Lisboa", address: ["Rua Castilho, 67, 4.º andar", "1250-071 Lisboa"] },
    { id: "porto", name: "ATN Medical Porto", short: "Porto", address: ["Rua Gonçalo Mendes da Maia, 35, Loja D", "4425-656 Maia"] },
  ],
  sources: referralClinicSources({
    recomendacao: "Outros pais, família, amigos",
    medicoLabel: "Pediatra ou médico",
    medico: "Pediatra, fisioterapeuta, hospital…",
  }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F1F9FD",
    ink: "#0A2534",
    muted: "#5B6F7C",
    line: "#D9E8F1",
    primary: "#00B2F4",
    deep: "#0073A3",
    accent: "#6FD3FA",
    mark: mark("atn-medical"),
    font: "inter",
    shape: "soft",
  },
  logo: logo("atn-medical", 38),
};

// clinicacolegiomilitar.com — o azul «Dental Estética» #203888 e o ciano do
// site #0CA8D8; Open Sans.
const COLEGIO_MILITAR: OrigemClient = {
  slug: "clinica-medica-dentaria-colegio-militar",
  brand: "Clínica Médica Dentária Colégio Militar",
  brandShort: "Colégio Militar",
  brandOf: "da Clínica Colégio Militar",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "lisboa",
      name: "Clínica Médica Dentária Colégio Militar",
      short: "Colégio Militar",
      address: ["Av. Colégio Militar, n.º 24, Loja A", "1500-185 Lisboa"],
    },
  ],
  sources: clinicSources({ medico: "Encaminhado, Médis, Multicare…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F1F9FD",
    ink: "#18213F",
    muted: "#646B7F",
    line: "#D8E8F0",
    primary: "#0CA8D8",
    deep: "#203888",
    accent: "#5CC4E8",
    mark: mark("clinica-medica-dentaria-colegio-militar"),
    font: "openSans",
    shape: "soft",
  },
  logo: logo("clinica-medica-dentaria-colegio-militar", 40),
};

// medway.pt — azul #00A0DF, azul-marinho #1F4984 e o dourado dos botões; Inter.
const MEDWAY: OrigemClient = {
  slug: "medway",
  brand: "Medway Clínicas",
  brandShort: "Medway",
  brandOf: "da Medway",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "gaia",
      name: "Clínica Dentária Vila Nova de Gaia",
      short: "Gaia",
      address: ["Av. da República, 1226, 2.º piso", "4430-192 Vila Nova de Gaia"],
    },
    {
      id: "feira",
      name: "Clínica Dentária Santa Maria da Feira",
      short: "Santa Maria da Feira",
      address: ["Rua do Centro Social, n.º 448", "4520-709 Souto, Santa Maria da Feira"],
    },
  ],
  sources: clinicSources({ medico: "Encaminhado, Médis, cheque-dentista…" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F1F9FD",
    ink: "#13284A",
    muted: "#616C7F",
    line: "#D9E8F1",
    primary: "#00A0DF",
    deep: "#1F4984",
    accent: "#EFC75E",
    mark: "check",
    font: "inter",
  },
  logo: logo("medway", 40),
};

// antoniogaspar.pt — preto e branco, o azul #467CFB e o verde #00D28D;
// Josefin Sans, cantos retos.
const ANTONIO_GASPAR: OrigemClient = {
  slug: "antonio-gaspar",
  brand: "António Gaspar — Physio Therapy & Performance",
  brandShort: "António Gaspar",
  brandOf: "do António Gaspar",
  person: PACIENTE,
  place: CLINICA,
  desk: RECECAO,
  sites: [
    {
      id: "carnaxide",
      name: "António Gaspar",
      short: "WTC Lisboa",
      address: ["World Trade Center Lisboa, Av. Vítor Figueiredo, 2A", "2790-255 Carnaxide"],
    },
  ],
  sources: clinicSources({ medico: "Médico, ortopedista, seguro…", porta: "Viu a clínica no WTC" }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F5F7FC",
    ink: "#111111",
    muted: "#646A78",
    line: "#E1E5EE",
    primary: "#467CFB",
    deep: "#1E22AA",
    accent: "#00D28D",
    mark: mark("antonio-gaspar", "svg"),
    font: "josefin",
    heading: 700,
    shape: "square",
  },
  logo: logo("antonio-gaspar", 42, "svg"),
};

// brancoptica.pt — azul-marinho #0C2240 e os azuis do globo; Assistant (a do
// site), cantos retos. As 17 lojas de brancoptica.pt/pages/lojas.
const BRANCOPTICA: OrigemClient = {
  slug: "brancoptica",
  brand: "Brancóptica",
  brandShort: "Brancóptica",
  brandOf: "da Brancóptica",
  person: CLIENTE,
  place: LOJA,
  desk: NA_LOJA,
  sites: [
    { id: "almeirim", name: "Almeirim", short: "Almeirim", address: ["Rua Dionísio Saraiva, 2B", "2080-104 Almeirim"] },
    {
      id: "alverca",
      name: "Alverca do Ribatejo",
      short: "Alverca",
      address: ["Rua Brigadeiro Fernando Alberto de Oliveira, 5, R/C Dto.", "2615-079 Alverca do Ribatejo"],
    },
    {
      id: "arruda",
      name: "Arruda dos Vinhos",
      short: "Arruda",
      address: ["Av. Eng. Adriano Brito da Conceição, 16 A", "2630-299 Arruda dos Vinhos"],
    },
    { id: "aveiras", name: "Aveiras de Cima", short: "Aveiras", address: ["Rua Dr. Francisco Maria de Almeida Grandela, 103", "2050-115 Aveiras de Cima"] },
    { id: "bobadela", name: "Bobadela", short: "Bobadela", address: ["Rua Amílcar Cabral, 10", "2695-097 Bobadela"] },
    { id: "cartaxo", name: "Cartaxo (sede)", short: "Cartaxo", address: ["Rua Serpa Pinto, 5", "2070-116 Cartaxo"] },
    {
      id: "cartaxo-cabreira",
      name: "Cartaxo · Quinta da Cabreira",
      short: "Qta. da Cabreira",
      address: ["Rua Maria Adelaide de Vitória Pereira Santos, 56", "2070-162 Cartaxo"],
    },
    { id: "coruche", name: "Coruche", short: "Coruche", address: ["Rua de Santarém, 54-56", "2100-228 Coruche"] },
    {
      id: "lisboa-aguiar",
      name: "Lisboa · Av. António Augusto de Aguiar",
      short: "Lisboa (Aguiar)",
      address: ["Av. António Augusto de Aguiar, 90-A", "1050-018 Lisboa"],
    },
    {
      id: "lisboa-bela-vista",
      name: "Lisboa · Bela Vista",
      short: "Lisboa (Bela Vista)",
      address: ["C.C. Pingo Doce da Bela Vista, Av. Santo Condestável, Loja 13", "1950-392 Lisboa"],
    },
    { id: "marinhais", name: "Marinhais", short: "Marinhais", address: ["Estrada Nacional 367, n.º 320", "2125-121 Marinhais"] },
    { id: "nazare", name: "Nazaré", short: "Nazaré", address: ["Av. Vieira Guimarães, 29", "2450-110 Nazaré"] },
    { id: "peniche", name: "Peniche", short: "Peniche", address: ["Largo Dom Pedro V, 1", "2520-243 Peniche"] },
    { id: "rio-maior", name: "Rio Maior", short: "Rio Maior", address: ["Av. Paulo VI, 49, R/C, Loja 2", "2040-325 Rio Maior"] },
    { id: "samora", name: "Samora Correia", short: "Samora Correia", address: ["Av. Prof. Egas Moniz, 1", "2135-232 Samora Correia"] },
    { id: "santarem", name: "Santarém", short: "Santarém", address: ["Rua Guilherme Azevedo, 6", "2000-245 Santarém"] },
    { id: "sao-martinho", name: "São Martinho do Porto", short: "S. Martinho", address: ["Rua Conde de Avelar, 23", "2460-642 São Martinho do Porto"] },
  ],
  sources: clinicSources({
    recomendacao: "Família, amigos, outro cliente",
    medico: "Oftalmologista, Médis, ADSE…",
    porta: "Viu a loja na rua",
  }),
  channels: DESK_CHANNELS,
  startDay: START,
  theme: {
    paper: "#F2F8FE",
    ink: "#0C2240",
    muted: "#606D7F",
    line: "#DCE7F2",
    primary: "#2A6FAE",
    deep: "#1B4278",
    accent: "#4FA6E4",
    mark: mark("brancoptica"),
    font: "assistant",
    shape: "square",
  },
  logo: logo("brancoptica", 30),
};

export const ORIGEM_CLIENTS: Record<string, OrigemClient> = Object.fromEntries(
  [
    MYMEDIC,
    AEGER_PRIMA,
    B_LIFE,
    MIMUS,
    SPINE_CENTER,
    MONTE_MAR,
    CDT,
    WHITE_CLINIC,
    SENTIR_SAUDE,
    FERNANDO_ALMEIDA,
    CIDALIA,
    MARATONA,
    PHYSIOHUB,
    ATN_MEDICAL,
    COLEGIO_MILITAR,
    MEDWAY,
    ANTONIO_GASPAR,
    BRANCOPTICA,
  ].map((c) => [c.slug, c]),
);
