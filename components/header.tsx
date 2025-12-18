"use client";

import { Menu, Search, Upload, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Status } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/use-wallet";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, address, connect } = useWallet();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <Image
            src="/avatar.png"
            alt="bitpic"
            width={32}
            height={32}
            className="rounded-sm"
          />
          <span className="font-mono font-bold text-lg tracking-tight">
            bitpic
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/upload"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Upload
          </Link>
          <Link
            href="/paymail"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Get Paymail
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            About
          </Link>
          <Link
            href="/api"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            API
          </Link>
          <Link
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </Link>
        </nav>

        {/* Search */}
        <div className="hidden flex-1 max-w-sm mx-8 md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search paymails..."
              className="w-full pl-9 border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
            />
          </div>
        </div>

        {/* Wallet Connect & Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Status />
          <Link href="/upload">
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </Link>
          {isConnected ? (
            <Button variant="ghost" size="sm" className="font-mono text-xs">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </Button>
          ) : (
            <Button onClick={connect} size="sm">
              Connect Wallet
            </Button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border md:hidden">
          <div className="container mx-auto max-w-7xl px-4 py-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search paymails..."
                className="w-full pl-9"
              />
            </div>
            <nav className="flex flex-col gap-2">
              <Link
                href="/upload"
                className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent rounded-sm"
              >
                Upload
              </Link>
              <Link
                href="/paymail"
                className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent rounded-sm"
              >
                Get Paymail
              </Link>
              <Link
                href="/about"
                className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent rounded-sm"
              >
                About
              </Link>
              <Link
                href="/api"
                className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent rounded-sm"
              >
                API
              </Link>
              <Link
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent rounded-sm"
              >
                GitHub
              </Link>
            </nav>
            <div className="pt-2 border-t">
              {isConnected ? (
                <div className="px-3 py-2 text-sm font-mono text-muted-foreground">
                  {address?.slice(0, 8)}...{address?.slice(-6)}
                </div>
              ) : (
                <Button onClick={connect} size="sm" className="w-full">
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
