import type { Metadata } from "next";
import { Feed } from "@/components/feed";

export const metadata: Metadata = {
  title: "Feed",
  description: "Recently registered BitPic avatars on the Bitcoin blockchain.",
  alternates: { canonical: "/feed" },
};

export default function FeedPage() {
  return <Feed />;
}
