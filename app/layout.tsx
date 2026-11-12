import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BRAND_NAME } from "@/lib/constants";
import { Providers } from "./providers";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const title = `${BRAND_NAME} — The Neutral Escrow Bridge for Social Commerce`;
const description =
  `${BRAND_NAME} holds buyer funds privately until doorstep delivery is verified. Link-based shielded Zcash escrow for WhatsApp and Instagram trade.`;

export const metadata: Metadata = {
  title: {
    template: `%s | ${BRAND_NAME}`,
    default: title,
  },
  description,
  openGraph: {
    title,
    description,
    siteName: BRAND_NAME,
    type: "website",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas text-primary-text">
        <div className="relative z-10 flex min-h-screen flex-1 flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
