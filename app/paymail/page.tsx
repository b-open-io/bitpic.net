"use client";

import { Check, ImageIcon, Loader2, Mail, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PaymailRegister } from "@/components/paymail-register";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { useWallet } from "@/lib/use-wallet";

export default function PaymailPage() {
  const [registerOpen, setRegisterOpen] = useState(false);
  const { isConnected, pubKey, connect } = useWallet();
  const [existingPaymail, setExistingPaymail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const checkExistingPaymail = useCallback(async () => {
    if (!pubKey) return;

    setIsLoading(true);
    try {
      const result = await api.lookupPaymailByPubkey(pubKey);
      if (result.found && result.paymail) {
        setExistingPaymail(result.paymail);
      } else {
        setExistingPaymail(null);
      }
    } catch (err) {
      console.error("Failed to lookup paymail:", err);
      setExistingPaymail(null);
    } finally {
      setIsLoading(false);
    }
  }, [pubKey]);

  // Check if user already has a registered paymail
  useEffect(() => {
    if (isConnected && pubKey) {
      checkExistingPaymail();
    } else {
      setExistingPaymail(null);
    }
  }, [isConnected, pubKey, checkExistingPaymail]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
    } catch (err) {
      console.error("Failed to connect:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {existingPaymail
              ? "Your @bitpic.net Paymail"
              : "Get Your @bitpic.net Paymail"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {existingPaymail
              ? "Manage your paymail address and upload your avatar"
              : "Free paymail address that forwards to your Yours Wallet. Receive BSV and ordinals with a memorable address."}
          </p>
          <div className="pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Checking your wallet...</span>
              </div>
            ) : existingPaymail ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-6 py-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="font-mono text-lg">{existingPaymail}</span>
                </div>
                <div className="flex justify-center gap-3">
                  <Button asChild size="lg" className="font-semibold">
                    <Link href="/upload">Upload Avatar</Link>
                  </Button>
                </div>
              </div>
            ) : isConnected ? (
              <Button
                size="lg"
                onClick={() => setRegisterOpen(true)}
                className="font-semibold"
              >
                Register Free
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleConnect}
                disabled={isConnecting}
                className="font-semibold"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 pt-8">
          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Avatar Hosting</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Host your profile picture on-chain. Your avatar is permanently
                stored and accessible through your paymail address.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Payment Address</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receive BSV payments using your easy-to-remember paymail instead
                of long wallet addresses. Forwards to your Yours Wallet.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Ordinals Receive</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receive 1Sat Ordinals NFTs directly to your paymail. Your
                ordinals address is linked for easy receiving.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Identity Ownership</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Your paymail is linked to your Yours Wallet identity key. Only
                you can update your avatar using your registered paymail.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="pt-8 space-y-6">
          <h2 className="text-xl font-bold text-center">How It Works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                step: 1,
                title: "Choose Handle",
                desc: "Pick your unique handle",
              },
              {
                step: 2,
                title: "Connect Wallet",
                desc: "Link your Yours Wallet",
              },
              {
                step: 3,
                title: "You're Live",
                desc: "Start using your paymail",
              },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                  {item.step}
                </div>
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {!existingPaymail && (
          <div className="text-center pt-8">
            {isConnected ? (
              <Button
                size="lg"
                onClick={() => setRegisterOpen(true)}
                className="font-semibold"
              >
                Get Started
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleConnect}
                disabled={isConnecting}
                className="font-semibold"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Wallet to Get Started"
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      <PaymailRegister open={registerOpen} onOpenChange={setRegisterOpen} />
    </div>
  );
}
