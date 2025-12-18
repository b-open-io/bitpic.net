"use client";

import { ImageIcon, Mail, Shield, Wallet } from "lucide-react";
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
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Get Your @bitpic.net Paymail
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The universal avatar standard for Bitcoin. Like Gravatar, but on-chain.
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
                of long wallet addresses.
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
                address handles both regular payments and inscriptions.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Universal Avatar</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Works like Gravatar. Your BitPic avatar automatically appears in
                any wallet, app, or service that resolves paymails.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="pt-8 space-y-6">
          <h2 className="text-xl font-bold text-center">How It Works</h2>
          <div className="grid gap-4 md:grid-cols-4">
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
              { step: 3, title: "Pay $1", desc: "One-time registration fee" },
              {
                step: 4,
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
        <div className="text-center pt-8">
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
