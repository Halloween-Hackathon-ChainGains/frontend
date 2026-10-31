import { Suspense } from "react";
import { Home } from "@/components/Home";

export const metadata = { title: "Join Loop" };

/** The QR code lands here: the same app, opened on the Join tab. */
export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <Home initialView="join" />
    </Suspense>
  );
}
