import type { Metadata } from "next";
import { Be_Vietnam_Pro, Caveat } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// A letra "manuscrita" das assinaturas nas folhas de ausência. Caveat e não
// uma script formal: tem os acentos e o Ç dos nomes portugueses e continua
// legível em tamanhos pequenos (o histórico e o Control Suite mostram a
// assinatura em miniatura).
const caveat = Caveat({
  variable: "--font-signature",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Wonder Ads — Workspace",
  description: "Internal workspace for the Wonder Ads team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${beVietnamPro.variable} ${caveat.variable} antialiased`}>{children}</body>
    </html>
  );
}
