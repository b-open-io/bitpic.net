package bitpic

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"

	compat "github.com/bsv-blockchain/go-sdk/compat/bsm"
	ec "github.com/bsv-blockchain/go-sdk/primitives/ec"
	"github.com/bsv-blockchain/go-sdk/script"
)

// VerifySignatureBytes verifies a BSM signature over the given message bytes
// against the provided public key.
//
//   - embed avatars sign the 32-byte SHA-256 of the image
//   - reference avatars sign the reference URI string (e.g. "ord://<txid>_<vout>")
//
// PubKeyFromSignature applies the Bitcoin Signed Message magic-hash internally,
// matching the wallet's signBsm, so callers pass the raw message bytes.
func VerifySignatureBytes(messageBytes []byte, pubKeyHex, signatureBase64 string) error {
	sigBytes, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("invalid signature base64: %w", err)
	}

	pubKeyBytes, err := hex.DecodeString(pubKeyHex)
	if err != nil {
		return fmt.Errorf("invalid public key hex: %w", err)
	}

	pubKey, err := ec.ParsePubKey(pubKeyBytes)
	if err != nil {
		return fmt.Errorf("failed to parse public key: %w", err)
	}

	// Recover the public key from the signature over the message.
	recoveredPubKey, wasCompressed, err := compat.PubKeyFromSignature(sigBytes, messageBytes)
	if err != nil {
		return fmt.Errorf("failed to recover public key from signature: %w", err)
	}

	providedAddr, err := script.NewAddressFromPublicKeyWithCompression(pubKey, true, true)
	if err != nil {
		return fmt.Errorf("failed to create address from public key: %w", err)
	}

	recoveredAddr, err := script.NewAddressFromPublicKeyWithCompression(recoveredPubKey, true, wasCompressed)
	if err != nil {
		return fmt.Errorf("failed to create address from recovered public key: %w", err)
	}

	if providedAddr.AddressString != recoveredAddr.AddressString {
		return fmt.Errorf("signature verification failed: public key mismatch (expected %s, got %s)",
			providedAddr.AddressString, recoveredAddr.AddressString)
	}

	return nil
}
