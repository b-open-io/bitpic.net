# Quick Start Guide

## Installation (3 commands)

```bash
# 1. Install wallet and cropper packages
bun add yours-wallet-provider react-easy-crop

# 2. Install shadcn slider component
bunx shadcn@latest add slider

# 3. Create environment file
cp .env.example .env.local
```

## Start Development

```bash
bun dev
```

Visit `http://localhost:3000`

## Test Upload Flow

1. Click "Connect Wallet" in header
2. Approve in Yours Wallet extension
3. Click "Upload" or go to `/upload`
4. Select or drag-and-drop image (PNG/JPEG, max 1MB)
5. Crop and adjust zoom
6. Enter paymail
7. Approve transaction in wallet
8. Get TXID confirmation

## Key Files Created

```
components/wallet-provider.tsx    # Yours Wallet context
components/upload-dialog.tsx      # Multi-step upload UI
components/image-cropper.tsx      # Circular crop with zoom
lib/use-wallet.ts                 # Wallet connection hook
lib/transaction-builder.ts        # BitPic OP_RETURN builder
lib/api.ts                        # Backend API client
app/upload/page.tsx               # Upload page
```

## Environment Variables

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Authentication Flow

```typescript
// 1. Connect wallet
const pubKey = await wallet.connect();

// 2. Sign paymail
const { sig } = await wallet.signMessage({
  message: paymail,
  encoding: "utf8"
});

// 3. Build transaction
const txData = buildBitPicOpReturn({
  paymail,
  publicKey: pubKey,
  signature: sig,
  imageData: base64Image,
  mimeType: "image/png"
});

// 4. Broadcast
const { txid } = await wallet.sendBsv([{
  satoshis: 0,
  data: txData
}]);
```

## Transaction Format

```
OP_RETURN
  18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p  // BitPic prefix
  <paymail>                            // user@example.com
  <publicKey>                          // From wallet
  <signature>                          // Sign paymail
  |                                    // Separator
  19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut  // B protocol
  <image_data>                         // Hex-encoded image
  image/png                            // MIME type
  binary                               // Encoding
```

## Troubleshooting

**Wallet won't connect:**
- Install Yours Wallet extension
- Unlock wallet
- Refresh page

**Upload fails:**
- Check image under 1MB
- Verify PNG or JPEG format
- Ensure backend running on port 8080

**TypeScript errors:**
- Run `bun install` to get all deps
- Restart TS server in IDE

## Documentation

- **Full Setup**: `SETUP.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **This Guide**: `QUICK_START.md`

## Support

Check browser console for errors. Ensure:
1. Yours Wallet installed and unlocked
2. Backend API running
3. Dependencies installed
4. Environment variables set
