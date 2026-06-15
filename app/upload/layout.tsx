import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Upload",
  description:
    "Set your Paymail avatar on the Bitcoin blockchain — upload an image or reference an ordinal you already own.",
  alternates: { canonical: "/upload" },
};

export default function UploadLayout({ children }: { children: ReactNode }) {
  return children;
}
