"use client";

import { useRouter } from "next/navigation";
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
    setTimeout(() => {
      router.push(`/?txid=${txid}`);
    }, 3000);
  };

  const handleClose = () => {
    router.push("/");
  };

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
          Upload Your Avatar
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Store your avatar permanently on the Bitcoin blockchain.
        </p>
      </div>

      {isConnected && address && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium">
              Connected Wallet
            </CardTitle>
            <CardDescription className="font-mono text-xs text-foreground/80">
              {address}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <UploadDialog onSuccess={handleSuccess} onClose={handleClose} />

      <div className="mt-12">
        <Card className="bg-muted/30 border-none shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Upload your image (PNG or JPEG, max 1MB)</li>
              <li>Crop and adjust your avatar</li>
              <li>Connect your Yours Wallet if not connected</li>
              <li>Enter your paymail address</li>
              <li>Sign the transaction with your wallet</li>
              <li>Your avatar is now on-chain forever</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="mt-4 bg-muted/30 border-none shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">What is BitPic?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              BitPic stores your avatar image directly on the Bitcoin
              blockchain, making it permanent and immutable. Your avatar is
              associated with your paymail address and authenticated using your
              Bitcoin wallet.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-4 font-mono">
              Protocol: 18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
