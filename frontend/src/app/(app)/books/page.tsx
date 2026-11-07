import type { Metadata } from "next";
import { BooksPage } from "@/components/pages/books";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Books" };

export default function Page() {
  return <BooksPage />;
}
