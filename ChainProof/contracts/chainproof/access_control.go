package main

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// =============================================================================
// ChainProof - Access Control
// =============================================================================
// MSP-based access control for organization-specific functions.
// Ensures only authorized orgs can perform specific actions.
// =============================================================================

// Organization MSP IDs (must match MICROFAB config)
const (
	WhistleblowersOrgMSP = "WhistleblowersOrgMSP"
	VerifierOrgMSP       = "VerifierOrgMSP"
	LegalOrgMSP          = "LegalOrgMSP"
)

// Private Data Collection Names
const (
	VerifierPrivateCollection = "VerifierPrivateCollection"
	LegalPrivateCollection    = "LegalPrivateCollection"
)

// GetClientOrgID returns the MSP ID of the calling client
func GetClientOrgID(ctx contractapi.TransactionContextInterface) (string, error) {
	clientOrgID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed to get client MSP ID: %v", err)
	}
	return clientOrgID, nil
}

// VerifyClientOrg checks if the caller belongs to the specified organization
func VerifyClientOrg(ctx contractapi.TransactionContextInterface, allowedMSP string) error {
	clientMSP, err := GetClientOrgID(ctx)
	if err != nil {
		return err
	}

	if clientMSP != allowedMSP {
		return fmt.Errorf("access denied: caller MSP '%s' is not authorized, required '%s'", clientMSP, allowedMSP)
	}

	return nil
}

// VerifyClientOrgMultiple checks if the caller belongs to any of the specified organizations
func VerifyClientOrgMultiple(ctx contractapi.TransactionContextInterface, allowedMSPs []string) error {
	clientMSP, err := GetClientOrgID(ctx)
	if err != nil {
		return err
	}

	for _, msp := range allowedMSPs {
		if clientMSP == msp {
			return nil
		}
	}

	return fmt.Errorf("access denied: caller MSP '%s' not in allowed list %v", clientMSP, allowedMSPs)
}

// RequireWhistleblowerOrg ensures caller is from WhistleblowersOrg
func RequireWhistleblowerOrg(ctx contractapi.TransactionContextInterface) error {
	return VerifyClientOrg(ctx, WhistleblowersOrgMSP)
}

// RequireVerifierOrg ensures caller is from VerifierOrg
func RequireVerifierOrg(ctx contractapi.TransactionContextInterface) error {
	return VerifyClientOrg(ctx, VerifierOrgMSP)
}

// RequireLegalOrg ensures caller is from LegalOrg
func RequireLegalOrg(ctx contractapi.TransactionContextInterface) error {
	return VerifyClientOrg(ctx, LegalOrgMSP)
}

// RequireAnyOrg ensures caller is from any of the three organizations
func RequireAnyOrg(ctx contractapi.TransactionContextInterface) error {
	return VerifyClientOrgMultiple(ctx, []string{
		WhistleblowersOrgMSP,
		VerifierOrgMSP,
		LegalOrgMSP,
	})
}

// IsWhistleblowerOrg checks if caller is from WhistleblowersOrg (non-throwing)
func IsWhistleblowerOrg(ctx contractapi.TransactionContextInterface) bool {
	return RequireWhistleblowerOrg(ctx) == nil
}

// IsVerifierOrg checks if caller is from VerifierOrg (non-throwing)
func IsVerifierOrg(ctx contractapi.TransactionContextInterface) bool {
	return RequireVerifierOrg(ctx) == nil
}

// IsLegalOrg checks if caller is from LegalOrg (non-throwing)
func IsLegalOrg(ctx contractapi.TransactionContextInterface) bool {
	return RequireLegalOrg(ctx) == nil
}
