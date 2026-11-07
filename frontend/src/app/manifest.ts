import type { MetadataRoute } from "next";

/** Lets phones install the site as an app with its own icon ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Khata: your money, books and dates",
    short_name: "Khata",
    description: "Income and expenses, monthly payments, loans, books, dates and a private vault.",
    start_url: "/overview",
    scope: "/",
    display: "standalone",
    background_color: "#161618",
    theme_color: "#0e0e0e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
