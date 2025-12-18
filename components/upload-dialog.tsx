"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImageCropper } from "@/components/image-cropper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import type { BitPicTransactionData } from "@/lib/transaction-builder";
import {
  buildBitPicOpReturn,
  validateImage,
} from "@/lib/transaction-builder";
import { useWallet } from "@/lib/use-wallet";

type Step = "upload" | "crop" | "connect" | "sign" | "success";

interface UploadDialogProps {
  onClose?: () => void;
  onSuccess?: (txid: string) => void;
}

export function UploadDialog({ onClose, onSuccess }: UploadDialogProps) {
  const { wallet, isConnected, connect, pubKey, socialProfile } = useWallet();
  const [step, setStep] = useState<Step>("upload");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [paymail, setPaymail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [loadingProfileImage, setLoadingProfileImage] = useState(false);

  // Load profile image from wallet social profile on mount
  useEffect(() => {
    if (socialProfile?.avatar && step === "upload" && !selectedImage) {
      loadProfileImage(socialProfile.avatar);
    }
  }, [socialProfile?.avatar, step, selectedImage]);

  const loadProfileImage = async (avatarUrl: string) => {
    setLoadingProfileImage(true);
    try {
      const response = await fetch(avatarUrl);
      if (!response.ok) throw new Error("Failed to fetch profile image");

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const validation = validateImage(result);

        if (validation.valid) {
          setSelectedImage(result);
          setStep("crop");
        }
        setLoadingProfileImage(false);
      };
      reader.onerror = () => setLoadingProfileImage(false);
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to load profile image:", err);
      setLoadingProfileImage(false);
    }
  };

  // Look up paymail when wallet connects
  useEffect(() => {
    if (isConnected && pubKey && step === "connect") {
      lookupPaymail();
    }
  }, [isConnected, pubKey, step]);

  const lookupPaymail = async () => {
    if (!pubKey) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.lookupPaymailByPubkey(pubKey);
      if (result.found && result.paymail) {
        setPaymail(result.paymail);
      } else {
        setPaymail(null);
      }
    } catch (err) {
      console.error("Failed to lookup paymail:", err);
      setPaymail(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const validation = validateImage(result);

        if (!validation.valid) {
          setError(validation.error || "Invalid image");
          return;
        }

        setSelectedImage(result);
        setError(null);
        setStep("crop");
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const validation = validateImage(result);

      if (!validation.valid) {
        setError(validation.error || "Invalid image");
        return;
      }

      setSelectedImage(result);
      setError(null);
      setStep("crop");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleCropComplete = useCallback((cropped: string) => {
    setCroppedImage(cropped);
    setStep("connect");
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await connect();
      // lookupPaymail will be called by useEffect when isConnected changes
    } catch (err) {
      setError("Failed to connect wallet");
      console.error(err);
      setIsLoading(false);
    }
  };

  const handleSignAndBroadcast = async () => {
    if (!wallet || !pubKey || !croppedImage || !paymail) {
      setError("Missing required data");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep("sign");

    try {
      // Sign the paymail with wallet
      const signedMessage = await wallet.signMessage({
        message: paymail,
        encoding: "utf8",
      });

      if (!signedMessage?.sig) {
        throw new Error("Failed to sign message");
      }

      const validation = validateImage(croppedImage);
      if (!validation.valid || !validation.mimeType) {
        throw new Error(validation.error || "Invalid image");
      }

      // Build transaction data
      const txData: BitPicTransactionData = {
        paymail,
        publicKey: pubKey,
        signature: signedMessage.sig,
        imageData: croppedImage,
        mimeType: validation.mimeType,
      };

      const opReturnData = buildBitPicOpReturn(txData);

      // Broadcast using Yours Wallet
      const result = await wallet.sendBsv([
        {
          satoshis: 0,
          data: opReturnData,
        },
      ]);

      if (!result?.txid) {
        throw new Error("Failed to broadcast transaction");
      }

      setTxid(result.txid);
      setStep("success");
      onSuccess?.(result.txid);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign and broadcast",
      );
      console.error("Error signing and broadcasting:", err);
      setStep("connect");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {step === "upload" && "Upload Avatar"}
          {step === "crop" && "Crop Avatar"}
          {step === "connect" && "Connect & Upload"}
          {step === "sign" && "Sign & Broadcast"}
          {step === "success" && "Success!"}
        </CardTitle>
        <CardDescription>
          {step === "upload" && "Choose an image for your BitPic avatar"}
          {step === "crop" && "Adjust your avatar crop and zoom"}
          {step === "connect" && "Connect your wallet to upload"}
          {step === "sign" && "Signing and broadcasting to Bitcoin..."}
          {step === "success" && "Your avatar has been uploaded to Bitcoin"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            {loadingProfileImage ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
                <p className="text-sm text-muted-foreground">
                  Loading your profile image...
                </p>
              </div>
            ) : (
              <>
                {socialProfile?.avatar && (
                  <div className="flex flex-col items-center gap-3 p-4 bg-muted/30 rounded-lg">
                    <img
                      src={socialProfile.avatar}
                      alt="Current profile"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                    <p className="text-sm text-muted-foreground">
                      {socialProfile.displayName
                        ? `Use ${socialProfile.displayName}'s profile image`
                        : "Use your current profile image"}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => loadProfileImage(socialProfile.avatar!)}
                    >
                      Use This Image
                    </Button>
                  </div>
                )}
                <section
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-muted-foreground transition-colors cursor-pointer"
                  aria-label="File drop zone"
                >
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/png,image/jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <svg
                        className="mx-auto h-12 w-12 text-muted-foreground"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <title>Upload Icon</title>
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="text-muted-foreground">
                        <span className="font-medium text-primary hover:text-primary/80">
                          {socialProfile?.avatar
                            ? "Or click to upload a different image"
                            : "Click to upload"}
                        </span>{" "}
                        {!socialProfile?.avatar && "or drag and drop"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PNG or JPEG up to 1MB
                      </p>
                    </div>
                  </label>
                </section>
              </>
            )}
          </div>
        )}

        {step === "crop" && selectedImage && (
          <ImageCropper
            image={selectedImage}
            onCropComplete={handleCropComplete}
            onCancel={() => {
              setStep("upload");
              setSelectedImage(null);
            }}
          />
        )}

        {step === "connect" && (
          <div className="space-y-4">
            {croppedImage && (
              <div className="flex justify-center mb-4">
                {/* biome-ignore lint/a11y/useAltText: Preview image */}
                <img
                  src={croppedImage}
                  alt="Cropped avatar preview"
                  className="w-32 h-32 rounded-full object-cover"
                />
              </div>
            )}

            {!isConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Connect your Yours Wallet to continue
                </p>
                <Button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Connecting..." : "Connect Wallet"}
                </Button>
              </div>
            ) : isLoading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
                <p className="text-sm text-muted-foreground">
                  Looking up your paymail...
                </p>
              </div>
            ) : paymail ? (
              <div className="space-y-4">
                <div className="rounded-sm border border-border/40 bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Uploading as
                  </p>
                  <p className="font-mono text-sm">{paymail}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep("crop");
                      setCroppedImage(null);
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSignAndBroadcast}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Upload to Bitcoin
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-sm text-foreground mb-2">
                    You need a @bitpic.net paymail to upload avatars
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Register a free paymail to link your avatar to your identity
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep("crop");
                      setCroppedImage(null);
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/paymail">Register Paymail</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "sign" && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
            <p className="text-muted-foreground">
              Signing and broadcasting transaction...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please confirm in your wallet
            </p>
          </div>
        )}

        {step === "success" && txid && (
          <div className="text-center space-y-4 py-4">
            {croppedImage && (
              <div className="flex justify-center mb-4">
                {/* biome-ignore lint/a11y/useAltText: Success preview */}
                <img
                  src={croppedImage}
                  alt="Uploaded avatar"
                  className="w-32 h-32 rounded-full object-cover"
                />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-primary font-medium">
                Avatar uploaded successfully!
              </p>
              {paymail && (
                <p className="text-sm text-muted-foreground">
                  Linked to <span className="font-mono">{paymail}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                Transaction ID:
              </p>
              <code className="block text-xs bg-muted p-2 rounded break-all font-mono">
                {txid}
              </code>
            </div>
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
