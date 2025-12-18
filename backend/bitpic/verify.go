package bitpic

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"

	compat "github.com/bsv-blockchain/go-sdk/compat/bsm"
	ec "github.com/bsv-blockchain/go-sdk/primitives/ec"
	"github.com/bsv-blockchain/go-sdk/script"
)

// VerifySignature verifies a BSM signature against a public key and image hash
// The imageHashHex is the SHA256 hash of the image data (hex encoded)
// The signature should be in base64 format
// The pubKeyHex is the public key from the BitPic transaction (hex encoded)
func VerifySignature(imageHashHex, pubKeyHex, signatureBase64 string) error {
	// Decode the signature from base64
	sigBytes, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("invalid signature base64: %w", err)
	}

	// Decode the image hash from hex - this is the message that was signed
	messageBytes, err := hex.DecodeString(imageHashHex)
	if err != nil {
		return fmt.Errorf("invalid image hash hex: %w", err)
	}

	// Decode the public key from hex
	pubKeyBytes, err := hex.DecodeString(pubKeyHex)
	if err != nil {
		return fmt.Errorf("invalid public key hex: %w", err)
	}

	// Parse the public key
	pubKey, err := ec.ParsePubKey(pubKeyBytes)
	if err != nil {
		return fmt.Errorf("failed to parse public key: %w", err)
	}

	// Recover the public key from the signature
	// BSM verification uses the raw message bytes (the image hash)
	recoveredPubKey, wasCompressed, err := compat.PubKeyFromSignature(sigBytes, messageBytes)
	if err != nil {
		return fmt.Errorf("failed to recover public key from signature: %w", err)
	}

	// Get the address from the provided public key
	providedAddr, err := script.NewAddressFromPublicKeyWithCompression(pubKey, true, true)
	if err != nil {
		return fmt.Errorf("failed to create address from public key: %w", err)
	}

	// Get the address from the recovered public key
	recoveredAddr, err := script.NewAddressFromPublicKeyWithCompression(recoveredPubKey, true, wasCompressed)
	if err != nil {
		return fmt.Errorf("failed to create address from recovered public key: %w", err)
	}

	// Compare addresses - the recovered address must match the provided pubkey's address
	if providedAddr.AddressString != recoveredAddr.AddressString {
		return fmt.Errorf("signature verification failed: public key mismatch (expected %s, got %s)",
			providedAddr.AddressString, recoveredAddr.AddressString)
	}

	return nil
}
