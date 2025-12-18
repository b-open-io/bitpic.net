"use client";

import { Image, Mail, Shield, Wallet } from "lucide-react";
import { useState } from "react";
import { PaymailRegister } from "@/components/paymail-register";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PaymailPage() {
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Get Your @bitpic.net Paymail
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Secure your unique paymail address on the Bitcoin SV blockchain
          </p>
          <div className="pt-4">
            <Button
              size="lg"
              onClick={() => setRegisterOpen(true)}
              className="font-semibold"
            >
              Register Now - $1
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 pt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Image className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Avatar Hosting</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Host your profile picture on-chain. Your avatar is permanently
                stored and accessible through your paymail address.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Payment Address</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receive BSV payments using your easy-to-remember paymail instead
                of long wallet addresses. Share handle@bitpic.net instead of
                cryptic keys.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Ordinals Receive</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receive 1Sat Ordinals NFTs directly to your paymail. Your
                address automatically handles both regular payments and ordinal
                inscriptions.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>On-Chain Identity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Your paymail is secured on the Bitcoin SV blockchain. Immutable,
                censorship-resistant, and fully under your control.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="pt-8 space-y-6">
          <h2 className="text-2xl font-bold text-center">How It Works</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                1
              </div>
              <h3 className="font-semibold">Choose Handle</h3>
              <p className="text-sm text-muted-foreground">
                Pick your unique handle (3-20 characters)
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                2
              </div>
              <h3 className="font-semibold">Connect Wallet</h3>
              <p className="text-sm text-muted-foreground">
                Link your Yours Wallet
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                3
              </div>
              <h3 className="font-semibold">Pay $1</h3>
              <p className="text-sm text-muted-foreground">
                One-time registration fee
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                4
              </div>
              <h3 className="font-semibold">You're Live</h3>
              <p className="text-sm text-muted-foreground">
                Start using your @bitpic.net paymail
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-8 pb-4">
          <Button
            size="lg"
            onClick={() => setRegisterOpen(true)}
            className="font-semibold"
          >
            Get Started
          </Button>
        </div>
      </div>

      <PaymailRegister open={registerOpen} onOpenChange={setRegisterOpen} />
    </div>
  );
}
