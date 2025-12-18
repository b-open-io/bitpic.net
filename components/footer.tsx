import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-8 mt-24">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-mono text-muted-foreground">
            © 2020-{new Date().getFullYear()} bitpic.net
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              API Docs
            </Link>
            <Link
              href="https://github.com/b-open-io/bitpic.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
