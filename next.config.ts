import type { NextConfig } from "next";

/** Host antigo → domínio próprio (v77.19).
 *
 *  Só entra em vigor quando LEGACY_HOST_REDIRECT=1 estiver definido na
 *  Vercel no momento do build — isto é, depois de workspace.wonder-ads.com
 *  estar verificado e a responder. Ligar antes disso deixaria a app
 *  inacessível (todos os pedidos ao host antigo saltariam para um domínio
 *  morto). Caminho e query string vão intactos: /a-domingos/pendingreview
 *  continua a ser /a-domingos/pendingreview no domínio novo.
 *
 *  As rotas /api ficam de fora de propósito: a interatividade do Slack
 *  (ausências), os callbacks OAuth do Ads e os crons batem no host antigo
 *  até serem reconfigurados, e um 308 aí partia-os. */
const LEGACY_HOST = "wonder-ads-workspace.vercel.app";
const NEW_ORIGIN = "https://workspace.wonder-ads.com";

const nextConfig: NextConfig = {
  async redirects() {
    if (process.env.LEGACY_HOST_REDIRECT !== "1") return [];
    return [
      {
        source: "/:path((?!api/|_next/).*)",
        has: [{ type: "host", value: LEGACY_HOST }],
        destination: `${NEW_ORIGIN}/:path`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
