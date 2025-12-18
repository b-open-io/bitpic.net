"use client";

import { useCallback, useState } from "react";
import { ImageCropper } from "@/components/image-cropper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BitPicTransactionData } from "@/lib/transaction-builder";
import {
  buildBitPicOpReturn,
  isValidPaymail,
  validateImage,
} from "@/lib/transaction-builder";
import { useWallet } from "@/lib/use-wallet";

type Step = "upload" | "crop" | "details" | "sign" | "success";

interface UploadDialogProps {
  onClose?: () => void;
  onSuccess?: (txid: string) => void;
}

export function UploadDialog({ onClose, onSuccess }: UploadDialogProps) {
  const { wallet, isConnected, connect, pubKey } = useWallet();
  const [step, setStep] = useState<Step>("upload");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [paymail, setPaymail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);

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
    setStep("details");
  }, []);

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

  const handleSignAndBroadcast = async () => {
    if (!wallet || !pubKey || !croppedImage) {
      setError("Missing required data");
      return;
    }

    if (!isValidPaymail(paymail)) {
      setError("Invalid paymail format");
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
      setStep("details");
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
          {step === "details" && "Enter Details"}
          {step === "sign" && "Sign & Broadcast"}
          {step === "success" && "Success!"}
        </CardTitle>
        <CardDescription>
          {step === "upload" && "Choose an image for your BitPic avatar"}
          {step === "crop" && "Adjust your avatar crop and zoom"}
          {step === "details" && "Connect wallet and enter your paymail"}
          {step === "sign" && "Signing and broadcasting to Bitcoin..."}
          {step === "success" && "Your avatar has been uploaded to Bitcoin"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {step === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors cursor-pointer"
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
                  className="mx-auto h-12 w-12 text-gray-400"
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
                <div className="text-gray-600">
                  <span className="font-medium text-blue-600 hover:text-blue-500">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </div>
                <p className="text-xs text-gray-500">PNG or JPEG up to 1MB</p>
              </div>
            </label>
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

        {step === "details" && (
          <div className="space-y-4">
            {croppedImage && (
              <div className="flex justify-center mb-4">
                <img
                  src={croppedImage}
                  alt="Cropped avatar preview"
                  className="w-32 h-32 rounded-full object-cover"
                />
              </div>
            )}

            {!isConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
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
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="paymail"
                    className="block text-sm font-medium mb-2"
                  >
                    Paymail
                  </label>
                  <Input
                    id="paymail"
                    type="email"
                    placeholder="you@example.com"
                    value={paymail}
                    onChange={(e) => setPaymail(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your BitPic will be associated with this paymail
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
                  <Button
                    onClick={handleSignAndBroadcast}
                    disabled={isLoading || !paymail}
                    className="flex-1"
                  >
                    {isLoading ? "Processing..." : "Upload to Bitcoin"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "sign" && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600">
              Signing and broadcasting transaction...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please confirm in your wallet
            </p>
          </div>
        )}

        {step === "success" && txid && (
          <div className="text-center space-y-4 py-4">
            {croppedImage && (
              <div className="flex justify-center mb-4">
                <img
                  src={croppedImage}
                  alt="Uploaded avatar"
                  className="w-32 h-32 rounded-full object-cover"
                />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-green-600 font-medium">
                Avatar uploaded successfully!
              </p>
              <p className="text-sm text-gray-600">Transaction ID:</p>
              <code className="block text-xs bg-gray-100 p-2 rounded break-all">
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
