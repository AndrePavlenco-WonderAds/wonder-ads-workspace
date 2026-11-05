// Origem de Pacientes — as letras dos clientes (v78.76), servidas pela app
// (next/font), sem pedidos ao Google no tablet da receção.
//
// Nenhuma é pré-carregada: com 13 letras no mesmo módulo, o preload faria
// cada página descarregar todas. O @font-face só baixa a letra que a página
// do cliente usa de facto (display: swap).
//
// O next/font exige chamadas literais, uma por constante — daí a repetição.

import {
  Assistant,
  DM_Sans,
  Exo_2,
  Inter,
  Josefin_Sans,
  Jost,
  Manrope,
  Montserrat,
  Nunito_Sans,
  Open_Sans,
  Oswald,
  Poppins,
  Raleway,
} from "next/font/google";
import type { OrigemFont } from "./config";

const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false });
const raleway = Raleway({ subsets: ["latin"], display: "swap", preload: false });
const josefin = Josefin_Sans({ subsets: ["latin"], display: "swap", preload: false });
const exo2 = Exo_2({ subsets: ["latin"], display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const jost = Jost({ subsets: ["latin"], display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], display: "swap", preload: false });
const oswald = Oswald({ subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap", preload: false });
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", preload: false });
const assistant = Assistant({ subsets: ["latin"], display: "swap", preload: false });

export const ORIGEM_FONTS: Record<OrigemFont, { className: string; style: { fontFamily: string } }> = {
  manrope,
  montserrat,
  dmSans,
  raleway,
  josefin,
  exo2,
  inter,
  jost,
  nunitoSans,
  oswald,
  poppins,
  openSans,
  assistant,
};
