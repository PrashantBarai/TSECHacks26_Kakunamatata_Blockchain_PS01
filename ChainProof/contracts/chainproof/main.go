package main

import (
	"fmt"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	// Create chaincode with all 4 contracts
	chainproofChaincode, err := contractapi.NewChaincode(
		&WhistleblowerContract{},  // Evidence submission (WhistleblowersOrg only)
		&VerifierContract{},       // Integrity verification (VerifierOrg only)
		&LegalContract{},          // Legal review & export (LegalOrg only)
		&QueryContract{},          // Read operations (Any Org)
	)

	if err != nil {
		log.Panicf("Error creating ChainProof chaincode: %v", err)
	}

	// Set chaincode info
	chainproofChaincode.Info.Title = "ChainProof - Secure Disclosure Network"
	chainproofChaincode.Info.Version = "1.0.0"

	// Start chaincode
	if err := chainproofChaincode.Start(); err != nil {
		log.Panicf("Error starting ChainProof chaincode: %v", err)
	}

	fmt.Println("ChainProof chaincode started successfully")
}
