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
import type {
  BitPicRefTransactionData,
  BitPicTransactionData,
} from "@/lib/transaction-builder";
import {
  buildBitPicOpReturn,
  buildBitPicRefOpReturn,
  getOrdfsUrl,
  validateImage,
} from "@/lib/transaction-builder";
import type { Ordinal } from "@/lib/use-wallet";
import { useWallet } from "@/lib/use-wallet";

type Step = "upload" | "crop" | "connect" | "sign" | "success";
type SourceMode = "upload" | "ordinal";

interface UploadDialogProps {
  onClose?: () => void;
  onSuccess?: (txid: string) => void;
}

export function UploadDialog({ onClose, onSuccess }: UploadDialogProps) {
  const {
    wallet,
    isConnected,
    connect,
    pubKey,
    socialProfile,
    ordinals,
    refreshOrdinals,
  } = useWallet();
  const [step, setStep] = useState<Step>("upload");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [selectedOrdinal, setSelectedOrdinal] = useState<Ordinal | null>(null);
  const [paymail, setPaymail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [loadingProfileImage, setLoadingProfileImage] = useState(false);
  const [loadingOrdinals, setLoadingOrdinals] = useState(false);

  // Filter ordinals to only show images
  const imageOrdinals = ordinals.filter((o) => {
    const fileType = o.data?.insc?.file?.type || "";
    return fileType.startsWith("image/");
  });

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
    if (!wallet || !pubKey || !paymail) {
      setError("Missing required data");
      return;
    }

    // For upload mode, we need a cropped image
    // For ordinal mode, we need a selected ordinal
    if (sourceMode === "upload" && !croppedImage) {
      setError("Missing cropped image");
      return;
    }
    if (sourceMode === "ordinal" && !selectedOrdinal) {
      setError("No ordinal selected");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep("sign");

    try {
      let opReturnData: string[];

      if (sourceMode === "ordinal" && selectedOrdinal) {
        // Ordinal reference mode - sign the ordinal reference
        const ordinalRef = selectedOrdinal.origin;

        const signedMessage = await wallet.signMessage({
          message: ordinalRef,
          encoding: "utf8",
        });

        if (!signedMessage?.sig) {
          throw new Error("Failed to sign message");
        }

        const txData: BitPicRefTransactionData = {
          paymail,
          publicKey: pubKey,
          signature: signedMessage.sig,
          ordinalRef,
        };

        opReturnData = buildBitPicRefOpReturn(txData);
      } else {
        // Upload mode - sign the image hash and embed image
        const validation = validateImage(croppedImage!);
        if (!validation.valid || !validation.mimeType) {
          throw new Error(validation.error || "Invalid image");
        }

        // Compute SHA256 hash of image bytes for signing
        const base64Data = croppedImage!.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const imageHash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Sign the image hash
        const signedMessage = await wallet.signMessage({
          message: imageHash,
          encoding: "utf8",
        });

        if (!signedMessage?.sig) {
          throw new Error("Failed to sign message");
        }

        const txData: BitPicTransactionData = {
          paymail,
          publicKey: pubKey,
          signature: signedMessage.sig,
          imageData: croppedImage!,
          mimeType: validation.mimeType,
        };

        opReturnData = buildBitPicOpReturn(txData);
      }

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
            {/* Mode toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setSourceMode("upload");
                  setSelectedOrdinal(null);
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  sourceMode === "upload"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Upload Image
              </button>
              <button
                type="button"
                onClick={async () => {
                  setSourceMode("ordinal");
                  setSelectedImage(null);
                  setCroppedImage(null);
                  if (ordinals.length === 0 && isConnected) {
                    setLoadingOrdinals(true);
                    await refreshOrdinals();
                    setLoadingOrdinals(false);
                  }
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  sourceMode === "ordinal"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Use On-Chain Image
              </button>
            </div>

            {sourceMode === "upload" ? (
              loadingProfileImage ? (
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
              )
            ) : (
              /* Ordinal selection mode */
              <div className="space-y-4">
                {!isConnected ? (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Connect your wallet to see your on-chain images
                    </p>
                    <Button onClick={handleConnect} disabled={isLoading}>
                      {isLoading ? "Connecting..." : "Connect Wallet"}
                    </Button>
                  </div>
                ) : loadingOrdinals ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Loading your on-chain images...
                    </p>
                  </div>
                ) : imageOrdinals.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-muted-foreground">
                      No on-chain images found in your wallet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Upload an image instead or inscribe some first
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Select an on-chain image to use as your avatar
                    </p>
                    <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                      {imageOrdinals.map((ordinal) => (
                        <button
                          key={ordinal.origin}
                          type="button"
                          onClick={() => setSelectedOrdinal(ordinal)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedOrdinal?.origin === ordinal.origin
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <img
                            src={getOrdfsUrl(ordinal.origin)}
                            alt="Ordinal"
                            className="w-full h-full object-cover"
                          />
                          {selectedOrdinal?.origin === ordinal.origin && (
                            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <svg
                                  className="w-4 h-4 text-primary-foreground"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <title>Selected</title>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedOrdinal && (
                      <Button
                        onClick={() => setStep("connect")}
                        className="w-full"
                      >
                        Continue with Selected Image
                      </Button>
                    )}
                  </>
                )}
              </div>
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
            {/* Preview - show cropped image for upload mode, ordinal for ordinal mode */}
            <div className="flex justify-center mb-4">
              {sourceMode === "ordinal" && selectedOrdinal ? (
                <img
                  src={getOrdfsUrl(selectedOrdinal.origin)}
                  alt="Selected ordinal preview"
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : croppedImage ? (
                <img
                  src={croppedImage}
                  alt="Cropped avatar preview"
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : null}
            </div>

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
                      if (sourceMode === "ordinal") {
                        setStep("upload");
                      } else {
                        setStep("crop");
                        setCroppedImage(null);
                      }
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
                    {sourceMode === "ordinal"
                      ? "Link to Bitcoin"
                      : "Upload to Bitcoin"}
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
                      if (sourceMode === "ordinal") {
                        setStep("upload");
                      } else {
                        setStep("crop");
                        setCroppedImage(null);
                      }
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
            <div className="flex justify-center mb-4">
              {sourceMode === "ordinal" && selectedOrdinal ? (
                <img
                  src={getOrdfsUrl(selectedOrdinal.origin)}
                  alt="Linked ordinal avatar"
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : croppedImage ? (
                <img
                  src={croppedImage}
                  alt="Uploaded avatar"
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-primary font-medium">
                {sourceMode === "ordinal"
                  ? "Avatar linked successfully!"
                  : "Avatar uploaded successfully!"}
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
