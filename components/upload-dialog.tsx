"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageCropper } from "@/components/image-cropper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Step = "select" | "crop" | "confirm" | "sign" | "success";
type SourceMode = "upload" | "onchain";

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

  const [step, setStep] = useState<Step>("select");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [selectedOrdinal, setSelectedOrdinal] = useState<Ordinal | null>(null);
  const [paymail, setPaymail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [loadingOrdinals, setLoadingOrdinals] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter ordinals to only show images
  const imageOrdinals = ordinals.filter((o) => {
    const fileType = o.data?.insc?.file?.type || "";
    return fileType.startsWith("image/");
  });

  const lookupPaymail = useCallback(async () => {
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
  }, [pubKey]);

  // Look up paymail when wallet connects and we're on confirm step
  useEffect(() => {
    if (isConnected && pubKey && step === "confirm") {
      lookupPaymail();
    }
  }, [isConnected, pubKey, step, lookupPaymail]);

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

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
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

  const handleUseProfileImage = async () => {
    if (!socialProfile?.avatar) return;
    setIsLoading(true);
    try {
      const response = await fetch(socialProfile.avatar);
      if (!response.ok) throw new Error("Failed to fetch profile image");

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const validation = validateImage(result);

        if (validation.valid) {
          setSelectedImage(result);
          setStep("crop");
        } else {
          setError(validation.error || "Invalid image format");
        }
        setIsLoading(false);
      };
      reader.onerror = () => {
        setError("Failed to load profile image");
        setIsLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to load profile image:", err);
      setError("Failed to load profile image");
      setIsLoading(false);
    }
  };

  const handleCropComplete = useCallback((cropped: string) => {
    setCroppedImage(cropped);
    setStep("confirm");
  }, []);

  const handleCropCancel = useCallback(() => {
    setSelectedImage(null);
    setStep("select");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSelectOrdinal = (ordinal: Ordinal) => {
    setSelectedOrdinal(ordinal);
    setStep("confirm");
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await connect();
    } catch (err) {
      setError("Failed to connect wallet");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = async (value: string) => {
    setSourceMode(value as SourceMode);
    setSelectedOrdinal(null);
    setSelectedImage(null);
    setCroppedImage(null);
    setError(null);

    if (value === "onchain" && ordinals.length === 0 && isConnected) {
      setLoadingOrdinals(true);
      await refreshOrdinals();
      setLoadingOrdinals(false);
    }
  };

  const handleBack = () => {
    if (sourceMode === "onchain") {
      setSelectedOrdinal(null);
      setStep("select");
    } else {
      setStep("crop");
      setCroppedImage(null);
    }
  };

  const handleSignAndBroadcast = async () => {
    if (!wallet || !pubKey || !paymail) {
      setError("Missing required data");
      return;
    }

    if (sourceMode === "upload" && !croppedImage) {
      setError("Missing cropped image");
      return;
    }
    if (sourceMode === "onchain" && !selectedOrdinal) {
      setError("No image selected");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep("sign");

    try {
      let opReturnData: string[];

      if (sourceMode === "onchain" && selectedOrdinal) {
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
        if (!croppedImage) {
          throw new Error("Missing cropped image");
        }

        const validation = validateImage(croppedImage);
        if (!validation.valid || !validation.mimeType) {
          throw new Error(validation.error || "Invalid image");
        }

        const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, "");
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
          imageData: croppedImage,
          mimeType: validation.mimeType,
        };

        opReturnData = buildBitPicOpReturn(txData);
      }

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
      setStep("confirm");
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "select":
        return "Choose Avatar";
      case "crop":
        return "Crop Avatar";
      case "confirm":
        return "Confirm Upload";
      case "sign":
        return "Broadcasting";
      case "success":
        return "Success!";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "select":
        return "Upload an image or select from your wallet";
      case "crop":
        return "Adjust the crop area for your avatar";
      case "confirm":
        return "Review and upload to Bitcoin";
      case "sign":
        return "Signing and broadcasting to Bitcoin...";
      case "success":
        return "Your avatar is now on the blockchain";
    }
  };

  const previewImage =
    sourceMode === "onchain" && selectedOrdinal
      ? getOrdfsUrl(selectedOrdinal.origin)
      : croppedImage;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{getStepTitle()}</CardTitle>
        <CardDescription>{getStepDescription()}</CardDescription>
      </CardHeader>

      <CardContent className="min-h-[400px]">
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {/* STEP: SELECT */}
        {step === "select" && (
          <Tabs
            value={sourceMode}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="upload">Upload Image</TabsTrigger>
              <TabsTrigger value="onchain">On-Chain Image</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 mt-0">
              {/* Profile image option */}
              {socialProfile?.avatar && (
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/30">
                  {/* biome-ignore lint/performance/noImgElement: Dynamic external URL from wallet */}
                  <img
                    src={socialProfile.avatar}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover border border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {socialProfile.displayName || "Profile Image"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use your current wallet profile
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleUseProfileImage}
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Use"}
                  </Button>
                </div>
              )}

              {/* Drop zone - div required for drag-and-drop */}
              {/* biome-ignore lint/a11y/useSemanticElements: div needed for drag-and-drop target */}
              <div
                role="button"
                tabIndex={0}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground hover:bg-muted/50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="bg-primary/10 p-4 rounded-full mx-auto w-fit mb-4">
                  <svg
                    className="w-8 h-8 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <title>Upload</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">
                  Click to upload or drag & drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG or JPEG up to 1MB
                </p>
              </div>
            </TabsContent>

            <TabsContent value="onchain" className="mt-0">
              {!isConnected ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-lg">
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <svg
                      className="w-8 h-8 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <title>Wallet</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your wallet to browse on-chain images
                  </p>
                  <Button onClick={handleConnect} disabled={isLoading}>
                    {isLoading ? "Connecting..." : "Connect Wallet"}
                  </Button>
                </div>
              ) : loadingOrdinals ? (
                <div className="h-[280px]">
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <Skeleton key={i} className="aspect-square rounded-lg" />
                    ))}
                  </div>
                </div>
              ) : imageOrdinals.length === 0 ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-lg">
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <svg
                      className="w-8 h-8 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <title>No images</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No images found in your wallet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try uploading an image instead
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="grid grid-cols-4 gap-3 pr-4">
                    {imageOrdinals.map((ordinal) => (
                      <button
                        key={ordinal.origin}
                        type="button"
                        onClick={() => handleSelectOrdinal(ordinal)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          selectedOrdinal?.origin === ordinal.origin
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        {/* biome-ignore lint/performance/noImgElement: Dynamic ORDFS URL */}
                        <img
                          src={getOrdfsUrl(ordinal.origin)}
                          alt="Selectable avatar"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* STEP: CROP */}
        {step === "crop" && selectedImage && (
          <ImageCropper
            image={selectedImage}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}

        {/* STEP: CONFIRM */}
        {step === "confirm" && (
          <div className="space-y-6">
            {/* Preview */}
            <div className="flex justify-center">
              {previewImage && (
                /* biome-ignore lint/performance/noImgElement: Dynamic preview from crop or ORDFS */
                <img
                  src={previewImage}
                  alt="Avatar preview"
                  className="w-32 h-32 rounded-full object-cover border-4 border-border"
                />
              )}
            </div>

            {!isConnected ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Yours Wallet to continue
                </p>
                <Button onClick={handleConnect} disabled={isLoading}>
                  {isLoading ? "Connecting..." : "Connect Wallet"}
                </Button>
              </div>
            ) : isLoading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-2" />
                <p className="text-sm text-muted-foreground">
                  Looking up your paymail...
                </p>
              </div>
            ) : paymail ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Uploading as
                  </p>
                  <p className="font-mono text-sm font-medium">{paymail}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSignAndBroadcast}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {sourceMode === "onchain"
                      ? "Link to Bitcoin"
                      : "Upload to Bitcoin"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
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
                    onClick={handleBack}
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

        {/* STEP: SIGN */}
        {step === "sign" && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mb-4" />
            <p className="text-foreground font-medium">
              Signing and broadcasting...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please confirm in your wallet
            </p>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === "success" && txid && (
          <div className="text-center space-y-6 py-4">
            <div className="flex justify-center">
              {previewImage && (
                /* biome-ignore lint/performance/noImgElement: Dynamic preview from crop or ORDFS */
                <img
                  src={previewImage}
                  alt="Uploaded avatar"
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-primary font-medium text-lg">
                {sourceMode === "onchain"
                  ? "Avatar linked successfully!"
                  : "Avatar uploaded successfully!"}
              </p>
              {paymail && (
                <p className="text-sm text-muted-foreground">
                  Linked to <span className="font-mono">{paymail}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Transaction ID</p>
              <code className="block text-xs bg-muted p-3 rounded-lg break-all font-mono">
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
