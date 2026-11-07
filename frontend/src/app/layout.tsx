import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

// Self-hosted variable font (SIL Open Font License; see src/fonts): no third-party requests.
const body = localFont({
  src: "../fonts/montserrat-latin-wght-normal.woff2",
  variable: "--font-body",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Khata: your money, books and dates", template: "%s · Khata" },
  description:
    "A personal ledger for income and expenses, monthly payments, loans, books, important dates and a private vault.",
  applicationName: "Khata",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#161618",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={body.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
