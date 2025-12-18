"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RegisterPaymailRequest } from "@/lib/api";
import { api } from "@/lib/api";
import { useWallet } from "@/lib/use-wallet";

interface PaymailRegisterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "handle" | "wallet" | "registering" | "success";

export function PaymailRegister({ open, onOpenChange }: PaymailRegisterProps) {
  const [step, setStep] = useState<Step>("handle");
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState("");
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { isConnected, connect, address, pubKey, ordAddress } = useWallet();

  const resetState = () => {
    setStep("handle");
    setHandle("");
    setHandleError("");
    setIsCheckingAvailability(false);
    setIsRegistering(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const validateHandle = (value: string): boolean => {
    if (value.length < 3 || value.length > 20) {
      setHandleError("Handle must be between 3 and 20 characters");
      return false;
    }
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      setHandleError("Handle can only contain letters and numbers");
      return false;
    }
    setHandleError("");
    return true;
  };

  const checkAvailability = async () => {
    if (!validateHandle(handle)) return;

    setIsCheckingAvailability(true);
    try {
      const result = await api.checkPaymailAvailable(handle.toLowerCase());
      if (result.available) {
        setStep("wallet");
      } else {
        setHandleError("This handle is already taken");
      }
    } catch {
      setHandleError("Failed to check availability. Please try again.");
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleWalletConnect = async () => {
    if (!isConnected) {
      try {
        await connect();
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        return;
      }
    }
    // Proceed to register after wallet is connected
    await registerPaymail();
  };

  const registerPaymail = async () => {
    if (!address || !pubKey || !ordAddress) {
      setHandleError("Wallet not properly connected. Please reconnect.");
      return;
    }

    setIsRegistering(true);
    setStep("registering");

    try {
      const request: RegisterPaymailRequest = {
        handle: handle.toLowerCase(),
        identityPubkey: pubKey,
        paymentAddress: address,
        ordAddress: ordAddress,
      };

      const result = await api.registerPaymail(request);

      if (result.success) {
        setStep("success");
      } else {
        throw new Error(result.error || "Failed to register paymail");
      }
    } catch (error) {
      console.error("Registration failed:", error);
      setHandleError(
        error instanceof Error ? error.message : "Registration failed",
      );
      setStep("wallet");
    } finally {
      setIsRegistering(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "handle":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Choose Your Handle</DialogTitle>
              <DialogDescription>
                Pick a unique handle for your @bitpic.net paymail address
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Input
                  placeholder="yourhandle"
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value);
                    setHandleError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && handle) {
                      checkAvailability();
                    }
                  }}
                  className="font-mono"
                />
                {handleError && (
                  <p className="text-sm text-destructive">{handleError}</p>
                )}
                {handle && !handleError && (
                  <p className="text-sm text-muted-foreground">
                    Your paymail:{" "}
                    <span className="font-mono text-foreground">
                      {handle.toLowerCase()}@bitpic.net
                    </span>
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={checkAvailability}
                disabled={!handle || isCheckingAvailability}
                className="w-full"
              >
                {isCheckingAvailability ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </DialogFooter>
          </>
        );

      case "wallet":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Connect Your Wallet</DialogTitle>
              <DialogDescription>
                Connect your Yours Wallet to register your paymail
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-sm border border-border/40 bg-muted/50 p-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your paymail:{" "}
                  <span className="font-mono text-foreground">
                    {handle.toLowerCase()}@bitpic.net
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Your wallet addresses will be linked to this paymail for
                  receiving payments and ordinals.
                </p>
              </div>
              {handleError && (
                <p className="text-sm text-destructive">{handleError}</p>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setStep("handle")}
                className="w-full"
              >
                Back
              </Button>
              <Button
                onClick={handleWalletConnect}
                disabled={isRegistering}
                className="w-full"
              >
                {isConnected ? "Register Paymail" : "Connect & Register"}
              </Button>
            </DialogFooter>
          </>
        );

      case "registering":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Registering Paymail</DialogTitle>
              <DialogDescription>
                Setting up your @bitpic.net address
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Linking your wallet addresses...
              </p>
            </div>
          </>
        );

      case "success":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Registration Complete
              </DialogTitle>
              <DialogDescription>Your paymail is now active</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-sm border border-green-500/40 bg-green-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-500" />
                  <p className="font-mono text-foreground">
                    {handle.toLowerCase()}@bitpic.net
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  Your paymail includes:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Avatar hosting via BitPic</li>
                  <li>BSV payment address resolution</li>
                  <li>Ordinals receive address</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">{renderStep()}</DialogContent>
    </Dialog>
  );
}
