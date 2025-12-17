# BitPic Setup Guide

Complete setup instructions for the BitPic frontend application.

## Prerequisites

- Bun runtime installed
- Yours Wallet browser extension
- Access to BitPic backend API (running on port 8080 by default)

## Installation Steps

### 1. Install Dependencies

```bash
cd /Users/satchmo/code/bitpic.net
bun add yours-wallet-provider react-easy-crop
bunx shadcn@latest add slider
```

### 2. Configure Environment Variables

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. Start Development Server

```bash
bun dev
```

The app will be available at `http://localhost:3000`

## Project Structure

```
/Users/satchmo/code/bitpic.net/
├── app/
│   ├── layout.tsx          # Root layout with WalletProvider
│   ├── page.tsx            # Home page
│   └── upload/
│       └── page.tsx        # Upload page
├── components/
│   ├── wallet-provider.tsx # Yours Wallet provider wrapper
│   ├── upload-dialog.tsx   # Multi-step upload dialog
│   └── image-cropper.tsx   # Image cropping component
├── lib/
│   ├── use-wallet.ts       # Wallet hook with connection management
│   ├── api.ts              # API client for backend
│   ├── transaction-builder.ts # BitPic transaction builder
│   └── utils.ts            # Utility functions
└── components/ui/          # shadcn UI components
```

## Features Implemented

### Wallet Integration

- **Provider**: `WalletProvider` wraps the entire app with Yours Wallet context
- **Hook**: `useWallet()` provides wallet state and connection methods
- **Events**: Handles `switchAccount` and `signedOut` events
- **State Management**: Tracks connection status, addresses, and public key

### Upload Flow

The upload process follows a 5-step flow:

1. **Upload**: Drag & drop or click to select image (PNG/JPEG, max 1MB)
2. **Crop**: Circular crop with zoom controls using react-easy-crop
3. **Details**: Connect wallet (if needed) and enter paymail
4. **Sign**: Sign paymail with wallet and broadcast transaction
5. **Success**: Display transaction ID and success message

### Transaction Building

The `transaction-builder.ts` module creates BitPic protocol transactions:

```typescript
// Transaction structure:
OP_RETURN
  18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p  // BitPic prefix
  <paymail>                            // User's paymail
  <publicKey>                          // From Yours Wallet
  <signature>                          // Sign paymail with wallet
  |                                    // Pipe separator
  19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut  // B protocol prefix
  <image_data>                         // Binary image data
  image/png                            // MIME type
  binary                               // Encoding
```

### API Client

The `api.ts` module provides methods for backend communication:

- `getAvatar(paymail)`: Fetch avatar for a paymail
- `getFeed(offset, limit)`: Get recent uploads feed
- `exists(paymail)`: Check if paymail has an avatar
- `broadcast(rawtx)`: Broadcast raw transaction (optional, wallet handles this)

## Authentication Flow

1. User initiates upload
2. Wallet connection requested (if not connected)
3. User enters paymail address
4. Paymail is signed using Yours Wallet's `signMessage()` method:
   ```typescript
   const { sig, pubKey } = await wallet.signMessage({
     message: paymail,
     encoding: "utf8"
   });
   ```
5. Signature proves ownership of the public key
6. Transaction is built with paymail, pubKey, and signature
7. Image data is appended using B protocol
8. Transaction is broadcast using `wallet.sendBsv()`

## Security Considerations

### Authentication

- **No private keys transmitted**: Only signatures are sent
- **Message signing**: Paymail is signed to prove ownership
- **Public key verification**: Backend can verify signature matches public key

### Validation

- **Image size limit**: Maximum 1MB to prevent blockchain bloat
- **Format validation**: Only PNG and JPEG allowed
- **Paymail format**: Validated using regex pattern
- **MIME type checking**: Extracted from data URL and validated

### Wallet Security

- **Connection events**: Handles account switches and sign-outs
- **User confirmation**: Wallet prompts for transaction approval
- **Auto-fund**: Wallet automatically funds transaction with UTXOs

## Usage Examples

### Basic Upload

```typescript
import { UploadDialog } from "@/components/upload-dialog";

function MyComponent() {
  return (
    <UploadDialog
      onSuccess={(txid) => console.log("Uploaded:", txid)}
      onClose={() => router.push("/")}
    />
  );
}
```

### Custom Wallet Integration

```typescript
import { useWallet } from "@/lib/use-wallet";

function WalletStatus() {
  const { isConnected, address, connect, disconnect } = useWallet();

  return (
    <div>
      {isConnected ? (
        <>
          <p>Connected: {address}</p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### API Usage

```typescript
import { api } from "@/lib/api";

// Fetch avatar
const avatar = await api.getAvatar("user@example.com");

// Check existence
const { exists } = await api.exists("user@example.com");

// Get feed
const { items } = await api.getFeed(0, 20);
```

## Troubleshooting

### Wallet Not Connecting

- Ensure Yours Wallet extension is installed
- Check browser console for errors
- Try refreshing the page
- Verify wallet is unlocked

### Image Upload Fails

- Check image size (max 1MB)
- Verify format (PNG or JPEG only)
- Ensure wallet has sufficient funds
- Check backend API is running

### Transaction Not Broadcasting

- Verify wallet approval dialog was accepted
- Check wallet balance for fees
- Ensure backend API is accessible
- Review browser console for errors

## Development Notes

### TypeScript Types

All components use strict TypeScript with proper type definitions:

- Wallet state interfaces in `use-wallet.ts`
- Transaction data types in `transaction-builder.ts`
- API response types in `api.ts`

### React Patterns

- Client components use `"use client"` directive
- Hooks follow React best practices
- State management with `useState` and `useCallback`
- Effect cleanup for event listeners

### Styling

- TailwindCSS v4 for utility classes
- shadcn/ui for pre-built components
- Responsive design for mobile and desktop
- Dark mode ready (theme-aware colors)

## Next Steps

1. Add user profile page at `/me/[paymail]`
2. Implement avatar feed on home page
3. Add search functionality
4. Create avatar history view
5. Implement avatar verification UI
6. Add social sharing features

## Resources

- [Yours Wallet Documentation](https://yours.org)
- [BitPic Protocol Specification](https://bitpic.network)
- [B Protocol](https://b.bitdb.network)
- [shadcn/ui Components](https://ui.shadcn.com)
- [react-easy-crop](https://github.com/ValentinH/react-easy-crop)
