package bitpic

import (
	"crypto/sha256"
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
	OpPipe      = 0x7c // Pipe separator for multi-protocol OP_RETURN
)

// BitPicData represents parsed BitPic protocol data from a transaction
type BitPicData struct {
	Paymail   string
	PubKey    string
	Signature string
	ImageHash string // SHA256 hash of image data (hex)
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
	var imageData []byte

	for i, output := range tx.Outputs {
		ls := output.LockingScript

		// Try to extract OP_RETURN data
		if !ls.IsData() {
			continue
		}

		// Parse the script into tapes with raw binary data
		tapes, rawTapes, err := extractTapesWithRaw(ls)
		if err != nil {
			continue
		}

		// Search each tape for protocol prefixes
		for ti, tape := range tapes {
			if len(tape) < 1 {
				continue
			}

			// Check for B protocol (image data) - need to get this first for hash
			if tape[0] == BProtocolPrefix && !bProtocolFound && len(rawTapes[ti]) >= 2 {
				data.Outpoint = fmt.Sprintf("%s_%d", txid, i)
				imageData = rawTapes[ti][1] // Raw image bytes
				bProtocolFound = true
			}

			// Check for BitPic prefix
			if tape[0] == BitPicPrefix && !bitpicFound && len(tape) >= 4 {
				data.Paymail = tape[1]
				data.PubKey = tape[2]
				data.Signature = tape[3]
				bitpicFound = true
			}
		}
	}

	if !bitpicFound {
		return nil, errors.New("BitPic protocol data not found in transaction")
	}

	if !bProtocolFound {
		return nil, errors.New("B protocol (image) data not found in transaction")
	}

	// Hash the image data
	if len(imageData) == 0 {
		return nil, errors.New("no image data found in B protocol")
	}
	hash := sha256.Sum256(imageData)
	data.ImageHash = hex.EncodeToString(hash[:])

	// Verify the signature against the image hash
	if err := VerifySignature(data.ImageHash, data.PubKey, data.Signature); err != nil {
		return nil, fmt.Errorf("signature verification failed: %w", err)
	}

	return data, nil
}

// extractTapesWithRaw parses an OP_RETURN script into tapes with both string and raw representations
func extractTapesWithRaw(ls *script.Script) ([][]string, [][][]byte, error) {
	var tapes [][]string
	var rawTapes [][][]byte
	var currentTape []string
	var currentRawTape [][]byte

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
		// Handle case where script starts with just OP_RETURN
		if index == 0 && scriptBytes[index] == OpRETURN {
			index++
			continue
		}

		if index >= len(scriptBytes) {
			break
		}

		opcode := scriptBytes[index]
		index++

		var dataLen int

		// Handle different push opcodes
		switch {
		case opcode > 0 && opcode <= 75:
			// Direct push (1-75 bytes)
			dataLen = int(opcode)
		case opcode == OpPUSHDATA1:
			if index >= len(scriptBytes) {
				break
			}
			dataLen = int(scriptBytes[index])
			index++
		case opcode == OpPUSHDATA2:
			if index+1 >= len(scriptBytes) {
				break
			}
			dataLen = int(scriptBytes[index]) | int(scriptBytes[index+1])<<8
			index += 2
		case opcode == OpPUSHDATA4:
			if index+3 >= len(scriptBytes) {
				break
			}
			dataLen = int(scriptBytes[index]) |
				int(scriptBytes[index+1])<<8 |
				int(scriptBytes[index+2])<<16 |
				int(scriptBytes[index+3])<<24
			index += 4
		default:
			// Unknown opcode, skip
			continue
		}

		// Extract the data
		if index+dataLen > len(scriptBytes) {
			break
		}
		data := make([]byte, dataLen)
		copy(data, scriptBytes[index:index+dataLen])
		index += dataLen

		// Check for pipe separator
		if len(data) == 1 && data[0] == OpPipe {
			// Start a new tape
			if len(currentTape) > 0 {
				tapes = append(tapes, currentTape)
				rawTapes = append(rawTapes, currentRawTape)
				currentTape = nil
				currentRawTape = nil
			}
			continue
		}

		// Store raw data
		currentRawTape = append(currentRawTape, data)

		// Try to convert to string, otherwise use hex
		str := string(data)
		if isPrintable(str) {
			currentTape = append(currentTape, str)
		} else {
			currentTape = append(currentTape, hex.EncodeToString(data))
		}
	}

	// Don't forget the last tape
	if len(currentTape) > 0 {
		tapes = append(tapes, currentTape)
		rawTapes = append(rawTapes, currentRawTape)
	}

	return tapes, rawTapes, nil
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
