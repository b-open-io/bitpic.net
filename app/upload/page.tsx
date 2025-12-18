"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadDialog } from "@/components/upload-dialog";
import { useWallet } from "@/lib/use-wallet";

export default function UploadPage() {
  const router = useRouter();
  const { isConnected, address } = useWallet();

  const handleSuccess = (txid: string) => {
    console.log("Upload successful:", txid);
    // Redirect to a success page or user profile after a short delay
    setTimeout(() => {
      router.push(`/?txid=${txid}`);
    }, 3000);
  };

  const handleClose = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Upload Your Avatar</h1>
          <p className="text-gray-600">
            Store your avatar permanently on the Bitcoin blockchain
          </p>
        </div>

        {isConnected && address && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Connected Wallet</CardTitle>
              <CardDescription className="font-mono text-xs">
                {address}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <UploadDialog onSuccess={handleSuccess} onClose={handleClose} />

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Upload your image (PNG or JPEG, max 1MB)</li>
                <li>Crop and adjust your avatar to a perfect circle</li>
                <li>Connect your Yours Wallet if not already connected</li>
                <li>Enter your paymail address</li>
                <li>Sign the transaction with your wallet</li>
                <li>Your avatar is permanently stored on Bitcoin!</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">What is BitPic?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>
                BitPic stores your avatar image directly on the Bitcoin
                blockchain, making it permanent and immutable. Your avatar is
                associated with your paymail address and authenticated using
                your Bitcoin wallet.
              </p>
              <p>
                The transaction includes your paymail, public key, and a
                cryptographic signature proving you own the paymail, along with
                your avatar image encoded using the B protocol.
              </p>
              <p className="text-xs text-gray-500 mt-4">
                Transaction format: BitPic protocol
                (18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p) + B protocol
                (19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut)
              </p>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Button variant="outline" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
