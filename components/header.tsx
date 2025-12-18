"use client";

import { Github, Menu, Upload, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/use-wallet";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/upload", label: "Upload" },
  { href: "/paymail", label: "Paymail" },
  { href: "/docs", label: "API" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, address, connect } = useWallet();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/avatar.png"
            alt="bitpic"
            width={24}
            height={24}
            className="rounded-sm"
          />
          <span className="font-mono font-bold text-base tracking-tight">
            bitpic
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="https://github.com/b-open-io/bitpic.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
          </Link>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/upload">
            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </Link>
          {isConnected ? (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs h-8 bg-muted/50"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </Button>
          ) : (
            <Button onClick={connect} size="sm" className="h-8 text-xs">
              Connect
            </Button>
          )}
        </div>

        {/* Mobile Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background p-4 space-y-4">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "text-sm font-medium py-1",
                  pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="https://github.com/b-open-io/bitpic.net"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-muted-foreground py-1"
            >
              GitHub
            </Link>
          </nav>
          <div className="pt-3 border-t border-border">
            {isConnected ? (
              <div className="font-mono text-xs text-muted-foreground">
                {address}
              </div>
            ) : (
              <Button onClick={connect} className="w-full" size="sm">
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
