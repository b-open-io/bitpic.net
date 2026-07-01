package bitpic

import (
	"fmt"

	"github.com/bsv-blockchain/go-sdk/transaction"
)

// FeePayment is the parsed result of a paymail registration fee transaction.
type FeePayment struct {
	TxID     string // txid of the fee transaction
	PaidSats uint64 // total satoshis paid to the fee address across all outputs
}

// VerifyFeePayment parses a raw transaction and totals the satoshis paid to
// feeAddress. It does not fetch anything from the network: the wallet-signed
// transaction is self-describing, so the fee can be confirmed the instant the
// user pays — no mempool/indexer race. The caller decides whether PaidSats is
// sufficient.
func VerifyFeePayment(txBytes []byte, feeAddress string) (*FeePayment, error) {
	tx, err := transaction.NewTransactionFromBytes(txBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse transaction: %w", err)
	}

	var paid uint64
	for _, output := range tx.Outputs {
		if output.LockingScript == nil || !output.LockingScript.IsP2PKH() {
			continue
		}
		addr, err := output.LockingScript.Address()
		if err != nil || addr == nil {
			continue
		}
		if addr.AddressString == feeAddress {
			paid += output.Satoshis
		}
	}

	return &FeePayment{TxID: tx.TxID().String(), PaidSats: paid}, nil
}
