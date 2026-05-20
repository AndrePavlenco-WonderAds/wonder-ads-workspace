// Public review-page layout. Isolated from the main app layout
// (PageShell, header nav, starfield, etc.) on purpose — the client
// landing on /<slug>/pendingreview must see ONLY the table + a thin
// Wonder Ads footer. No back-button into the workspace, no
// department picker, no internal-tooling chrome.

import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "../globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pending Review · Wonder Ads",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PublicReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={beVietnam.className}>
      <body
        className="min-h-screen text-black antialiased"
        style={{ background: "#f4f4ed" }}
      >
        {children}
      </body>
    </html>
  );
}
