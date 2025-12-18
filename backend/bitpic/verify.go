package bitpic

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"

	compat "github.com/bsv-blockchain/go-sdk/compat/bsm"
	ec "github.com/bsv-blockchain/go-sdk/primitives/ec"
	"github.com/bsv-blockchain/go-sdk/script"
)

// VerifySignature verifies a BSM signature against a public key and message
// The signature should be in base64 format, message is the paymail string
func VerifySignature(message, pubKeyHex, signatureBase64 string) error {
	// Decode the signature from base64
	sigBytes, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("invalid signature base64: %w", err)
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

	// Recover the public key from the signature and verify it matches
	recoveredPubKey, wasCompressed, err := compat.PubKeyFromSignature(sigBytes, []byte(message))
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

	// Compare addresses
	if providedAddr.AddressString != recoveredAddr.AddressString {
		return fmt.Errorf("signature verification failed: public key mismatch (expected %s, got %s)",
			providedAddr.AddressString, recoveredAddr.AddressString)
	}

	return nil
}
