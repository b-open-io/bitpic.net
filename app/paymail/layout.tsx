import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Paymail",
  description:
    "Register a @bitpic.net paymail with a built-in on-chain avatar, BSV payment resolution, and ordinals receiving. One-time $1 fee.",
  alternates: { canonical: "/paymail" },
};

export default function PaymailLayout({ children }: { children: ReactNode }) {
  return children;
}
