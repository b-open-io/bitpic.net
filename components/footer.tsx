export function Footer() {
  return (
    <footer className="border-t border-border/40 py-8 mt-24">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-mono text-muted-foreground">
          © 2020-{new Date().getFullYear()} bitpic.net
        </p>
      </div>
    </footer>
  );
}
