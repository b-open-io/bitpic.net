import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Feed } from "@/components/feed"
import { Footer } from "@/components/footer"

const mockConfirmed = [
  { paymail: "satoshi@relayx.io", imageUrl: "/avatar.png", timestamp: "2m ago" },
  { paymail: "alice@handcash.io", imageUrl: "/avatar.png", timestamp: "5m ago" },
  { paymail: "bob@moneybutton.com", imageUrl: "/avatar.png", timestamp: "12m ago" },
  { paymail: "charlie@simply.cash", imageUrl: "/avatar.png", timestamp: "23m ago" },
  { paymail: "diana@relayx.io", imageUrl: "/avatar.png", timestamp: "1h ago" },
  { paymail: "eve@handcash.io", imageUrl: "/avatar.png", timestamp: "2h ago" },
  { paymail: "frank@moneybutton.com", imageUrl: "/avatar.png", timestamp: "3h ago" },
  { paymail: "grace@simply.cash", imageUrl: "/avatar.png", timestamp: "5h ago" },
  { paymail: "henry@relayx.io", imageUrl: "/avatar.png", timestamp: "8h ago" },
  { paymail: "isabella@handcash.io", imageUrl: "/avatar.png", timestamp: "12h ago" },
  { paymail: "jack@moneybutton.com", imageUrl: "/avatar.png", timestamp: "1d ago" },
  { paymail: "kate@simply.cash", imageUrl: "/avatar.png", timestamp: "2d ago" },
]

const mockUnconfirmed = [
  { paymail: "newuser@relayx.io", imageUrl: "/avatar.png", timestamp: "pending" },
  { paymail: "test@handcash.io", imageUrl: "/avatar.png", timestamp: "pending" },
]

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Feed confirmed={mockConfirmed} unconfirmed={mockUnconfirmed} />
      </main>
      <Footer />
    </div>
  )
}
