import type { Metadata } from "next";
import { ChallengesPage } from "@/components/pages/challenges";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Challenges" };

export default function Page() {
  return <ChallengesPage />;
}
