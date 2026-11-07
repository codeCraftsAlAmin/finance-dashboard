import type { PaymentStatus } from "@/lib/types";
import { AlertIcon, CheckIcon, ClockIcon } from "./icons";
import { Chip } from "./ui";

/** Status is always icon + word, never color alone. */
export function StatusChip({ status, kind }: { status: PaymentStatus; kind: "income" | "expense" }) {
  const paidWord = kind === "income" ? "Received" : "Paid";
  switch (status) {
    case "paid":
      return (
        <Chip tone="good" icon={<CheckIcon size={13} />}>
          {paidWord}
        </Chip>
      );
    case "overdue":
      return (
        <Chip tone="bad" icon={<AlertIcon size={13} />}>
          Overdue
        </Chip>
      );
    case "due":
      return (
        <Chip tone="warn" icon={<ClockIcon size={13} />}>
          {kind === "income" ? "Expected" : "Due"}
        </Chip>
      );
    default:
      return <Chip>Upcoming</Chip>;
  }
}
