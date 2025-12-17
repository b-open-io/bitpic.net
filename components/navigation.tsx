"use client";

import Link from "next/link";
import { useWallet } from "@/lib/use-wallet";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const { isConnected, address, connect, disconnect } = useWallet();

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              BitPic
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/upload"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Upload
              </Link>
              <Link
                href="/feed"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Feed
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isConnected ? (
              <>
                <div className="hidden sm:block text-sm text-gray-600">
                  <span className="font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={connect}>
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
