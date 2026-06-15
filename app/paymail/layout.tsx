import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Paymail",
  description:
    "Register a free @bitpic.net paymail with a built-in on-chain avatar, BSV payment resolution, and ordinals receiving.",
  alternates: { canonical: "/paymail" },
};

export default function PaymailLayout({ children }: { children: ReactNode }) {
  return children;
}
