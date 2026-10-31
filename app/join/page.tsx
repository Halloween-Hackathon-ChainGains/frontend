import { Suspense } from "react";
import { JoinFlow } from "@/components/join/JoinFlow";

export const metadata = { title: "Join Loop" };

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinFlow />
    </Suspense>
  );
}
