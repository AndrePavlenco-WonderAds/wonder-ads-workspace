"use client";

// A assinatura da WonderAds no rodapé das páginas Origem (v78.77): a
// borboleta do logótipo oficial (wonder-ads.com/…/WonderAds-Logo.svg),
// facetada e com brilho como no site, o nome e a frase «Parceiro Líder em SEO
// para Marcas de Saúde e Bem-Estar». É o único bloco escuro da página — o
// resto continua a vestir a marca do cliente.
//
// As asas batem ao abrir a página e quando se passa por cima (nunca com
// «reduzir movimento»). Liga para wonder-ads.com.

import { useCallback, useEffect, useId } from "react";
import { motion, useAnimationControls, useReducedMotion, type Variants } from "motion/react";
import { ArrowUpRight } from "lucide-react";

export const WA_TAGLINE = "Parceiro Líder em SEO para Marcas de Saúde e Bem-Estar";

// As quatro asas do logótipo (viewBox do logótipo: o corpo fica em x ≈ 19,4).
const WINGS = {
  upperLeft: "M18.5041 16.8109V30.3205C18.5041 30.3205 13.4511 25.7829 5.61286 18.2539C-2.22543 10.7248 1.28143 0.000488281 1.28143 0.000488281L18.5041 16.8109Z",
  lowerLeft: "M18.5041 30.3206L15.8434 39.9998C9.82205 37.5261 7.24045 30.9917 10.2176 22.6333L18.5041 30.3206Z",
  upperRight: "M20.3018 16.8109V30.3205C20.3018 30.3205 25.3548 25.7829 33.1931 18.2539C41.0314 10.7248 37.5245 0.000488281 37.5245 0.000488281L20.3018 16.8109Z",
  lowerRight: "M20.3018 30.3206L22.965 39.9998C28.9863 37.5261 31.5655 30.9917 28.5884 22.6333L20.3018 30.3206Z",
};
// As facetas claras (a luz vem de cima, como na borboleta 3D do site).
const FACETS = {
  upperLeft: "M5.61286 18.2539C-2.22543 10.7248 1.28143 0.000488281 1.28143 0.000488281L18.5041 16.8109Z",
  lowerLeft: "M15.8434 39.9998C9.82205 37.5261 7.24045 30.9917 10.2176 22.6333Z",
  upperRight: "M33.1931 18.2539C41.0314 10.7248 37.5245 0.000488281 37.5245 0.000488281L20.3018 16.8109Z",
  lowerRight: "M22.965 39.9998C28.9863 37.5261 31.5655 30.9917 28.5884 22.6333Z",
};
// «Wonder» e «Ads», as letras do logótipo.
const WORDMARK = { wonder: "M64.7164 16.0847L60.0398 33.8851H56.7319L53.2466 20.7949L50.085 33.8851H46.8394L42.0621 16.0847H45.4036L48.7906 29.0599L51.9379 16.0847H55.1331L58.6184 29.0599L61.9335 16.0847H64.7164ZM75.4216 34.1607C73.0989 34.1583 71.2867 33.2714 69.9923 31.5C68.7027 29.7238 68.0555 27.533 68.0555 24.925C68.0555 22.3362 68.7411 20.1669 70.1145 18.4266C71.4928 16.6816 73.3074 15.8091 75.5606 15.8091C77.8354 15.8091 79.6332 16.6816 80.9491 18.4266C82.2699 20.1669 82.9315 22.3482 82.9315 24.9657C82.9315 27.7127 82.2435 29.9324 80.8748 31.6247C79.5013 33.317 77.6868 34.1583 75.4216 34.1607ZM75.4479 31.5767C76.5841 31.5767 77.5429 31.0997 78.3292 30.1433C79.1178 29.1845 79.5109 27.4539 79.5109 24.9394C79.5109 22.8947 79.1825 21.2935 78.5353 20.1357C77.8881 18.9732 76.879 18.3955 75.5127 18.3955C72.8088 18.3955 71.4617 20.6079 71.4617 25.0329C71.4617 27.1782 71.8045 28.8082 72.4948 29.9156C73.1804 31.023 74.1655 31.5767 75.4479 31.5767ZM101.554 33.8851H98.493L91.8508 22.5136C91.7501 22.3386 91.5848 22.0581 91.3522 21.6674C91.2492 21.4948 91.091 21.2192 90.8824 20.8428V33.8851H88.344V16.0847H91.8245L97.9537 26.567C98.0016 26.658 98.3731 27.2933 99.0683 28.487V16.0847H101.554V33.8851ZM107.784 33.8851V16.0847H114.232C116.615 16.0847 118.527 16.9453 119.97 18.6615C121.413 20.3754 122.135 22.4944 122.135 25.0185C122.135 27.5378 121.392 29.6471 119.906 31.3442C118.422 33.0413 116.291 33.8851 113.522 33.8851H107.784ZM111.025 31.2651H113.654C115.064 31.2651 116.257 30.7258 117.243 29.6471C118.225 28.5709 118.714 26.9649 118.714 24.8363C118.714 23.0961 118.285 21.6267 117.43 20.421C116.567 19.2201 115.435 18.6136 114.026 18.6136H111.025V31.2651ZM138.905 33.8851H127.54V16.0847H138.789V18.7335H130.69V23.5587H137.198V26.1403H130.69V31.1213H138.905V33.8851ZM157.736 33.8851H154.404L151.688 26.567H147.251V33.8851H144.101V16.0847H151.688C153.795 16.0847 155.348 16.5713 156.336 17.5421C157.33 18.5081 157.824 19.7618 157.824 21.3031C157.824 23.585 156.774 25.1623 154.67 26.0204L157.736 33.8851ZM147.251 23.9997H151.175C152.309 23.9997 153.157 23.76 153.713 23.271C154.267 22.7844 154.543 22.1133 154.543 21.2623C154.543 20.4785 154.272 19.8457 153.725 19.3663C153.179 18.8797 152.412 18.64 151.429 18.64H147.251V23.9997Z", ads: "M177.164 33.8851H173.796L172.396 29.6471H165.667L164.299 33.8851H161.609L167.412 16.0847H171.293L177.164 33.8851ZM171.55 27.0799L169.002 19.1338L166.451 27.0799H171.55ZM181.653 33.8851V16.0847H188.101C190.484 16.0847 192.394 16.9453 193.84 18.6615C195.283 20.3754 196.004 22.4944 196.004 25.0185C196.004 27.5378 195.261 29.6471 193.773 31.3442C192.291 33.0413 190.16 33.8851 187.392 33.8851H181.653ZM184.894 31.2651H187.523C188.931 31.2651 190.124 30.7258 191.109 29.6471C192.095 28.5709 192.584 26.9649 192.584 24.8363C192.584 23.0961 192.155 21.6267 191.296 20.421C190.436 19.2201 189.302 18.6136 187.895 18.6136H184.894V31.2651ZM199.576 29.5944L202.637 28.9304C203.006 30.6946 204.413 31.5767 206.868 31.5767C207.982 31.5767 208.845 31.3538 209.447 30.8984C210.051 30.4501 210.35 29.8892 210.35 29.2157C210.35 28.7315 210.214 28.2808 209.943 27.8685C209.667 27.4539 209.08 27.1279 208.183 26.8977L204.842 26.0084C203.696 25.704 202.853 25.3565 202.306 24.9753C201.757 24.587 201.316 24.0405 200.988 23.3358C200.659 22.6334 200.494 21.8808 200.494 21.0802C200.494 19.4909 201.076 18.2133 202.239 17.2521C203.404 16.2909 204.885 15.8091 206.697 15.8091C208.2 15.8091 209.545 16.1471 210.729 16.8158C211.911 17.4822 212.666 18.4314 212.99 19.6611L209.991 20.4162C209.531 19.0666 208.454 18.3955 206.762 18.3955C205.777 18.3955 205.029 18.6016 204.514 19.0187C203.998 19.4382 203.739 19.9679 203.739 20.6127C203.739 21.6267 204.55 22.3386 206.172 22.7485L209.147 23.5059C210.947 23.9638 212.155 24.6445 212.771 25.5434C213.387 26.4471 213.694 27.4395 213.694 28.5253C213.694 30.2728 213.047 31.6511 211.753 32.653C210.458 33.6598 208.783 34.1583 206.724 34.1607C204.991 34.1583 203.473 33.7892 202.169 33.0485C200.865 32.3102 200 31.1621 199.576 29.5944Z" };

const WING: Variants = {
  rest: { scaleX: 1 },
  flap: { scaleX: [1, 0.4, 1, 0.66, 1], transition: { duration: 1.1, ease: "easeInOut" } },
};
const HINGE = { transformOrigin: "19.4px 20px", transformBox: "view-box" } as const;

type WingControls = ReturnType<typeof useAnimationControls>;

export function WonderAdsButterfly({ controls, className = "" }: { controls?: WingControls; className?: string }) {
  const id = useId().replace(/:/g, "");
  const g = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="-0.8 -0.8 40.4 41.6" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-ul`} gradientUnits="userSpaceOnUse" x1="1.3" y1="0" x2="18.5" y2="30">
          <stop offset="0" stopColor="#8A95FF" />
          <stop offset="1" stopColor="#2B2FB8" />
        </linearGradient>
        <linearGradient id={`${id}-ur`} gradientUnits="userSpaceOnUse" x1="37.5" y1="0" x2="20.3" y2="30">
          <stop offset="0" stopColor="#6D78F2" />
          <stop offset="1" stopColor="#22259C" />
        </linearGradient>
        <linearGradient id={`${id}-ll`} gradientUnits="userSpaceOnUse" x1="10" y1="22" x2="16" y2="40">
          <stop offset="0" stopColor="#F294EF" />
          <stop offset="1" stopColor="#B126B6" />
        </linearGradient>
        <linearGradient id={`${id}-lr`} gradientUnits="userSpaceOnUse" x1="28.6" y1="22" x2="23" y2="40">
          <stop offset="0" stopColor="#D873DB" />
          <stop offset="1" stopColor="#8C1B95" />
        </linearGradient>
      </defs>
      <motion.g variants={WING} initial="rest" animate={controls} style={HINGE}>
        <path d={WINGS.lowerLeft} fill={g("ll")} />
        <path d={FACETS.lowerLeft} fill="#fff" fillOpacity={0.22} />
        <path d={WINGS.upperLeft} fill={g("ul")} />
        <path d={FACETS.upperLeft} fill="#fff" fillOpacity={0.3} />
      </motion.g>
      <motion.g variants={WING} initial="rest" animate={controls} style={HINGE}>
        <path d={WINGS.lowerRight} fill={g("lr")} />
        <path d={FACETS.lowerRight} fill="#fff" fillOpacity={0.14} />
        <path d={WINGS.upperRight} fill={g("ur")} />
        <path d={FACETS.upperRight} fill="#fff" fillOpacity={0.2} />
      </motion.g>
    </svg>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="41.75 15.5 172.25 19" className={className} role="img" aria-label="WonderAds">
      <path d={WORDMARK.wonder} fill="#FFFFFF" />
      <path d={WORDMARK.ads} fill="#EA86EC" />
    </svg>
  );
}

/**
 * O rodapé das páginas Origem: uma faixa escura de ponta a ponta, como o
 * rodapé de um site, com a assinatura à esquerda e o que a página quiser à
 * direita (o «Terminar sessão neste aparelho» da receção).
 */
export function WonderAdsFooter({ children }: { children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const flap = useCallback(() => {
    if (!reduce) void controls.start("flap");
  }, [controls, reduce]);

  // Um bater de asas quando a página abre.
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => void controls.start("flap"), 900);
    return () => clearTimeout(t);
  }, [controls, reduce]);

  return (
    <footer
      className="relative isolate w-full overflow-hidden bg-[#0F0B21] text-white"
      style={{ fontFamily: "var(--font-be-vietnam-pro), system-ui, sans-serif" }}
    >
      {/* O fio de cima no gradiente da marca, o brilho atrás da borboleta e
          os riscos de luz do site. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#343ED7_18%,#783DF5_50%,#C535C9_82%,transparent)] opacity-70" />
      <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(120,61,245,0.32),transparent)]" />
      <span aria-hidden className="pointer-events-none absolute -right-20 -bottom-28 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(197,53,201,0.16),transparent)]" />
      <span aria-hidden className="pointer-events-none absolute left-[22%] top-5 hidden h-px w-56 -rotate-[8deg] bg-gradient-to-r from-transparent via-[#8E7CFF]/40 to-transparent sm:block" />
      <span aria-hidden className="pointer-events-none absolute bottom-4 right-[18%] hidden h-px w-44 -rotate-[14deg] bg-gradient-to-r from-transparent via-[#C86CFF]/35 to-transparent sm:block" />

      <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 sm:px-8">
        <motion.a
          href="https://wonder-ads.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WonderAds — ${WA_TAGLINE}`}
          onHoverStart={flap}
          onFocus={flap}
          className="group inline-flex min-w-0 max-w-full items-center gap-3.5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <span className="relative grid h-[52px] w-[52px] shrink-0 place-items-center">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(140,84,255,0.75),rgba(197,53,201,0.3)_62%,transparent)] blur-[5px]"
              animate={reduce ? undefined : { opacity: [0.55, 1, 0.55], scale: [0.9, 1.06, 0.9] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <WonderAdsButterfly controls={controls} className="relative h-[38px] w-[38px] drop-shadow-[0_0_7px_rgba(150,90,255,0.6)]" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <Wordmark className="block h-[15px] w-auto" />
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-white/0 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/70"
                aria-hidden
              />
            </span>
            <span className="mt-1.5 block text-[12.5px] font-medium leading-snug text-white/60 transition-colors group-hover:text-white/80">
              {WA_TAGLINE}
            </span>
          </span>
        </motion.a>
        {children}
      </div>
    </footer>
  );
}
