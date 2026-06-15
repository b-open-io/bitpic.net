package bitpic

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/bitcoin-sv/go-templates/template/bitcom"
	"github.com/bsv-blockchain/go-sdk/script"
	"github.com/bsv-blockchain/go-sdk/transaction"
)

const (
	// BitPicPrefix is the Bitcom protocol address for BitPic metadata.
	BitPicPrefix = "18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p"
	// UriListMime marks a B record whose data is a reference (text/uri-list).
	UriListMime = "text/uri-list"
	// LegacyRefMime is the original (pre-uri-list) BitPic reference media type.
	LegacyRefMime = "application/x-bitpic-ref"
)

// BitPicData represents parsed BitPic protocol data from a transaction.
type BitPicData struct {
	Paymail   string
	PubKey    string
	Signature string
	ImageHash string // SHA256 of embedded image (hex); empty for references
	Outpoint  string // txid_vout of the BitPic output
	TxID      string
	Timestamp int64
	IsRef     bool   // true when the avatar references existing content
	RefOrigin string // txid_vout of the referenced content (for refs)
}

// ParseTransaction extracts BitPic protocol data from a raw transaction.
//
// Layout (two Bitcom protocols separated by a pipe):
//
//	OP_FALSE OP_RETURN
//	  19Hxig… (B)       <image|uri>  <media-type>  <encoding>
//	  |
//	  18pAq…  (BitPic)  <paymail>    <pubkey>      <signature>
func ParseTransaction(txBytes []byte) (*BitPicData, error) {
	tx, err := transaction.NewTransactionFromBytes(txBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse transaction: %w", err)
	}

	txid := tx.TxID().String()

	for i, output := range tx.Outputs {
		bc := bitcom.Decode(output.LockingScript)
		if bc == nil || len(bc.Protocols) == 0 {
			continue
		}

		var b *bitcom.B
		var paymail, pubKey, sig string
		bitpicFound := false

		for _, proto := range bc.Protocols {
			switch proto.Protocol {
			case bitcom.BPrefix:
				b = bitcom.DecodeB(proto.Script)
			case BitPicPrefix:
				if p, pk, s, ok := parseBitPicTape(proto.Script); ok {
					paymail, pubKey, sig = p, pk, s
					bitpicFound = true
				}
			}
		}

		if !bitpicFound || b == nil || len(b.Data) == 0 {
			continue
		}

		data := &BitPicData{
			TxID:      txid,
			Outpoint:  fmt.Sprintf("%s_%d", txid, i),
			Paymail:   paymail,
			PubKey:    pubKey,
			Signature: sig,
		}

		mediaType := string(b.MediaType)
		switch {
		case mediaType == UriListMime:
			uri, refOrigin, ok := parseUriListRef(b.Data)
			if !ok {
				return nil, errors.New("no resolvable ord:// or b:// reference in uri-list")
			}
			data.IsRef = true
			data.RefOrigin = refOrigin
			if err := VerifySignatureBytes([]byte(uri), pubKey, sig); err != nil {
				return nil, fmt.Errorf("signature verification failed: %w", err)
			}
			return data, nil

		case mediaType == LegacyRefMime:
			refOrigin := normalizeOutpoint(string(b.Data))
			if !isValidOutpoint(refOrigin) {
				return nil, fmt.Errorf("invalid ordinal reference format: %s", refOrigin)
			}
			data.IsRef = true
			data.RefOrigin = refOrigin
			if err := VerifySignatureBytes([]byte(string(b.Data)), pubKey, sig); err != nil {
				return nil, fmt.Errorf("signature verification failed: %w", err)
			}
			return data, nil

		case strings.HasPrefix(mediaType, "image/"):
			hash := sha256.Sum256(b.Data)
			data.ImageHash = hex.EncodeToString(hash[:])
			if err := VerifySignatureBytes(hash[:], pubKey, sig); err != nil {
				return nil, fmt.Errorf("signature verification failed: %w", err)
			}
			return data, nil

		default:
			return nil, fmt.Errorf("unsupported BitPic media type: %s", mediaType)
		}
	}

	return nil, errors.New("BitPic protocol data not found in transaction")
}

// parseBitPicTape reads the BitPic tape's pushdata: paymail, pubkey, signature.
func parseBitPicTape(scriptBytes []byte) (paymail, pubKey, sig string, ok bool) {
	chunks, err := script.NewFromBytes(scriptBytes).Chunks()
	if err != nil || len(chunks) < 3 {
		return "", "", "", false
	}
	return string(chunks[0].Data), string(chunks[1].Data), string(chunks[2].Data), true
}

// parseUriListRef returns the first resolvable URI (ord:// or b://) and its
// normalized txid_vout. c://, https:// and other schemes are skipped (no
// indexer). Comment lines (#) and blanks are ignored.
func parseUriListRef(data []byte) (uri, refOrigin string, ok bool) {
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		var raw string
		switch {
		case strings.HasPrefix(line, "ord://"):
			raw = strings.TrimPrefix(line, "ord://")
		case strings.HasPrefix(line, "b://"):
			raw = strings.TrimPrefix(line, "b://")
		default:
			continue
		}
		outpoint := normalizeOutpoint(raw)
		if isValidOutpoint(outpoint) {
			return line, outpoint, true
		}
	}
	return "", "", false
}

// normalizeOutpoint converts txid.vout to txid_vout.
func normalizeOutpoint(outpoint string) string {
	if dot := strings.LastIndex(outpoint, "."); dot > 0 {
		return outpoint[:dot] + "_" + outpoint[dot+1:]
	}
	return outpoint
}

// isValidOutpoint validates a txid_vout reference.
func isValidOutpoint(outpoint string) bool {
	parts := strings.Split(outpoint, "_")
	if len(parts) != 2 || len(parts[0]) != 64 {
		return false
	}
	for _, c := range parts[0] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	if len(parts[1]) == 0 {
		return false
	}
	for _, c := range parts[1] {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
