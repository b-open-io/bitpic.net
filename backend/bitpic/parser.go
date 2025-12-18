package bitpic

import (
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/bsv-blockchain/go-sdk/script"
	"github.com/bsv-blockchain/go-sdk/transaction"
)

const (
	// BitPicPrefix is the address for BitPic protocol transactions
	BitPicPrefix = "18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p"
	// BProtocolPrefix is the address for B protocol (file upload)
	BProtocolPrefix = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut"
)

// Script opcodes
const (
	OpFALSE     = 0x00
	OpRETURN    = 0x6a
	OpPUSHDATA1 = 0x4c
	OpPUSHDATA2 = 0x4d
	OpPUSHDATA4 = 0x4e
)

// BitPicData represents parsed BitPic protocol data from a transaction
type BitPicData struct {
	Paymail   string
	PubKey    string
	Signature string
	Outpoint  string // Format: txid_vout
	TxID      string
	Timestamp int64
}

// ParseTransaction parses a raw transaction and extracts BitPic protocol data
func ParseTransaction(txBytes []byte) (*BitPicData, error) {
	tx, err := transaction.NewTransactionFromBytes(txBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse transaction: %w", err)
	}

	txid := tx.TxID().String()
	data := &BitPicData{
		TxID: txid,
	}

	// Find BitPic protocol data
	bitpicFound := false
	bProtocolFound := false

	for i, output := range tx.Outputs {
		ls := output.LockingScript

		// Try to extract OP_RETURN data
		if !ls.IsData() {
			continue
		}

		// Parse the script chunks
		parts, err := extractScriptParts(ls)
		if err != nil {
			continue
		}

		if len(parts) < 2 {
			continue
		}

		// Check for BitPic prefix
		if parts[0] == BitPicPrefix && !bitpicFound {
			if len(parts) >= 4 {
				data.Paymail = parts[1]
				data.PubKey = parts[2]
				data.Signature = parts[3]
				bitpicFound = true
			}
		}

		// Check for B protocol (image data)
		if parts[0] == BProtocolPrefix && !bProtocolFound {
			data.Outpoint = fmt.Sprintf("%s_%d", txid, i)
			bProtocolFound = true
		}
	}

	if !bitpicFound {
		return nil, errors.New("BitPic protocol data not found in transaction")
	}

	if !bProtocolFound {
		return nil, errors.New("B protocol (image) data not found in transaction")
	}

	// Verify the signature
	if err := VerifySignature(data.Paymail, data.PubKey, data.Signature); err != nil {
		return nil, fmt.Errorf("signature verification failed: %w", err)
	}

	return data, nil
}

// extractScriptParts extracts string parts from an OP_RETURN script
func extractScriptParts(ls *script.Script) ([]string, error) {
	var parts []string

	scriptBytes := *ls
	index := 0

	for index < len(scriptBytes) {
		// Skip OP_FALSE and OP_RETURN at the beginning
		if index == 0 && scriptBytes[index] == OpFALSE {
			index++
			continue
		}
		if index == 1 && scriptBytes[index] == OpRETURN {
			index++
			continue
		}

		if index >= len(scriptBytes) {
			break
		}

		opcode := scriptBytes[index]
		index++

		var dataLen int
		var data []byte

		// Handle different push opcodes
		switch {
		case opcode <= OpPUSHDATA4:
			// Direct push (1-75 bytes)
			if opcode > 0 && opcode <= 75 {
				dataLen = int(opcode)
			} else if opcode == OpPUSHDATA1 {
				if index >= len(scriptBytes) {
					return parts, nil
				}
				dataLen = int(scriptBytes[index])
				index++
			} else if opcode == OpPUSHDATA2 {
				if index+1 >= len(scriptBytes) {
					return parts, nil
				}
				dataLen = int(scriptBytes[index]) | int(scriptBytes[index+1])<<8
				index += 2
			} else if opcode == OpPUSHDATA4 {
				if index+3 >= len(scriptBytes) {
					return parts, nil
				}
				dataLen = int(scriptBytes[index]) |
					int(scriptBytes[index+1])<<8 |
					int(scriptBytes[index+2])<<16 |
					int(scriptBytes[index+3])<<24
				index += 4
			}

			// Extract the data
			if index+dataLen > len(scriptBytes) {
				return parts, nil
			}
			data = scriptBytes[index : index+dataLen]
			index += dataLen

			// Try to convert to string, otherwise use hex
			str := string(data)
			if isPrintable(str) {
				parts = append(parts, str)
			} else {
				parts = append(parts, hex.EncodeToString(data))
			}
		}
	}

	return parts, nil
}

// isPrintable checks if a string contains only printable characters
func isPrintable(s string) bool {
	for _, r := range s {
		if r < 32 || r > 126 {
			return false
		}
	}
	return true
}
