package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// =============================================================================
// ChainProof - Multi-Contract Smart Contracts
// =============================================================================
// Secure, anonymous whistleblowing platform chaincode.
// Implements 4 separate contracts for each organization role.
//
// Contracts:
//   - WhistleblowerContract: Evidence submission (WhistleblowersOrg only)
//   - VerifierContract: Integrity verification (VerifierOrg only)
//   - LegalContract: Legal review and export (LegalOrg only)
//   - QueryContract: Read-only operations (Any Org)
// =============================================================================

// =============================================================================
// WHISTLEBLOWER CONTRACT (WhistleblowersOrg only)
// =============================================================================

// WhistleblowerContract handles evidence submission operations
type WhistleblowerContract struct {
	contractapi.Contract
}

// InitLedger initializes the chaincode
func (c *WhistleblowerContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("ChainProof chaincode initialized successfully")
	return nil
}

// SubmitEvidence creates a new evidence record on the public ledger
func (c *WhistleblowerContract) SubmitEvidence(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
	ipfsCid string,
	fileHash string,
	fileType string,
	fileSize int64,
	category string,
) error {
	// Access control: only WhistleblowersOrg can submit
	if err := RequireWhistleblowerOrg(ctx); err != nil {
		return err
	}

	// Check if evidence already exists
	exists, err := evidenceExists(ctx, evidenceId)
	if err != nil {
		return fmt.Errorf("failed to check evidence existence: %v", err)
	}
	if exists {
		return fmt.Errorf("evidence %s already exists", evidenceId)
	}

	// Get caller org for custody log
	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()

	// Create initial custody log entry
	custodyLog := []CustodyLog{
		{
			Action:      ActionSubmit,
			ActorOrg:    callerOrg,
			Timestamp:   timestamp,
			Description: "Evidence submitted anonymously",
		},
	}

	// Create evidence record
	evidence := Evidence{
		DocType:         "evidence",
		EvidenceID:      evidenceId,
		IPFSCID:         ipfsCid,
		FileHash:        fileHash,
		FileType:        fileType,
		FileSize:        fileSize,
		Category:        category,
		SubmittedAt:     timestamp,
		Status:          StatusSubmitted,
		IntegrityStatus: IntegrityPending,
		CustodyLog:      custodyLog,
	}

	// Store on public ledger
	evidenceJSON, err := json.Marshal(evidence)
	if err != nil {
		return fmt.Errorf("failed to marshal evidence: %v", err)
	}

	return ctx.GetStub().PutState(evidenceId, evidenceJSON)
}

// SubmitBulkEvidence submits multiple evidence items in a single transaction
func (c *WhistleblowerContract) SubmitBulkEvidence(
	ctx contractapi.TransactionContextInterface,
	bulkSubmissionId string,
	itemsJSON string,
) (*BulkSubmissionResult, error) {
	// Access control: only WhistleblowersOrg can submit
	if err := RequireWhistleblowerOrg(ctx); err != nil {
		return nil, err
	}

	// Parse bulk items
	var items []BulkEvidenceItem
	if err := json.Unmarshal([]byte(itemsJSON), &items); err != nil {
		return nil, fmt.Errorf("failed to parse bulk items: %v", err)
	}

	if len(items) == 0 {
		return nil, fmt.Errorf("bulk submission must contain at least one item")
	}

	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()
	var evidenceIDs []string

	// Process each item
	for idx, item := range items {
		// Check if evidence already exists
		exists, err := evidenceExists(ctx, item.EvidenceID)
		if err != nil {
			return nil, fmt.Errorf("failed to check evidence existence for %s: %v", item.EvidenceID, err)
		}
		if exists {
			return nil, fmt.Errorf("evidence %s already exists", item.EvidenceID)
		}

		// Create custody log for bulk submission
		custodyLog := []CustodyLog{
			{
				Action:      ActionBulkSubmit,
				ActorOrg:    callerOrg,
				Timestamp:   timestamp,
				Description: fmt.Sprintf("Bulk submission %s - item %d of %d", bulkSubmissionId, idx+1, len(items)),
			},
		}

		// Create evidence record
		evidence := Evidence{
			DocType:          "evidence",
			EvidenceID:       item.EvidenceID,
			IPFSCID:          item.IPFSCID,
			FileHash:         item.FileHash,
			FileType:         item.FileType,
			FileSize:         item.FileSize,
			Category:         item.Category,
			SubmittedAt:      timestamp,
			Status:           StatusSubmitted,
			IntegrityStatus:  IntegrityPending,
			CustodyLog:       custodyLog,
			BulkSubmissionID: bulkSubmissionId,
			BulkIndex:        idx,
		}

		// Store on public ledger
		evidenceJSON, err := json.Marshal(evidence)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal evidence %s: %v", item.EvidenceID, err)
		}

		if err := ctx.GetStub().PutState(item.EvidenceID, evidenceJSON); err != nil {
			return nil, fmt.Errorf("failed to store evidence %s: %v", item.EvidenceID, err)
		}

		evidenceIDs = append(evidenceIDs, item.EvidenceID)
	}

	return &BulkSubmissionResult{
		BulkSubmissionID: bulkSubmissionId,
		SubmittedCount:   len(items),
		EvidenceIDs:      evidenceIDs,
		SubmittedAt:      timestamp,
	}, nil
}

// UpdatePolygonAnchor records the public blockchain timestamp transaction
func (c *WhistleblowerContract) UpdatePolygonAnchor(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
	polygonTxHash string,
) error {
	// Access control
	if err := RequireWhistleblowerOrg(ctx); err != nil {
		return err
	}

	evidence, err := getEvidence(ctx, evidenceId)
	if err != nil {
		return err
	}

	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()

	// Update Polygon anchor info
	evidence.PolygonTxHash = polygonTxHash
	evidence.PolygonAnchorAt = timestamp

	// Add custody log
	evidence.CustodyLog = append(evidence.CustodyLog, CustodyLog{
		Action:      ActionAnchor,
		ActorOrg:    callerOrg,
		Timestamp:   timestamp,
		Description: fmt.Sprintf("Anchored to Polygon: %s", polygonTxHash),
	})

	return putEvidence(ctx, evidence)
}

// =============================================================================
// VERIFIER CONTRACT (VerifierOrg only)
// =============================================================================

// VerifierContract handles integrity verification operations
type VerifierContract struct {
	contractapi.Contract
}

// VerifyIntegrity records the result of hash verification
func (c *VerifierContract) VerifyIntegrity(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
	computedHash string,
	passed bool,
) error {
	// Access control: only VerifierOrg can verify
	if err := RequireVerifierOrg(ctx); err != nil {
		return err
	}

	evidence, err := getEvidence(ctx, evidenceId)
	if err != nil {
		return err
	}

	// Check current status allows verification
	if evidence.Status != StatusSubmitted {
		return fmt.Errorf("evidence status must be %s to verify, current: %s", StatusSubmitted, evidence.Status)
	}

	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()

	// Update integrity status based on verification result
	if passed {
		evidence.IntegrityStatus = IntegrityVerified
		evidence.Status = StatusVerified
	} else {
		evidence.IntegrityStatus = IntegrityFailed
		evidence.Status = StatusIntegrityFailed
	}
	evidence.VerifiedAt = timestamp

	// Build verification description
	description := fmt.Sprintf("Integrity check: computed=%s, stored=%s, result=%t",
		computedHash, evidence.FileHash, passed)

	// Add custody log
	evidence.CustodyLog = append(evidence.CustodyLog, CustodyLog{
		Action:      ActionVerify,
		ActorOrg:    callerOrg,
		Timestamp:   timestamp,
		Description: description,
	})

	return putEvidence(ctx, evidence)
}

// AddVerificationNote adds private technical notes (PDC - VerifierOrg only)
func (c *VerifierContract) AddVerificationNote(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
	noteId string,
	content string,
	hashComparison string,
) error {
	// Access control
	if err := RequireVerifierOrg(ctx); err != nil {
		return err
	}

	// Verify evidence exists
	exists, err := evidenceExists(ctx, evidenceId)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("evidence %s does not exist", evidenceId)
	}

	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()

	// Create verification note
	note := VerificationNote{
		DocType:        "verification_note",
		EvidenceID:     evidenceId,
		NoteID:         noteId,
		Content:        content,
		HashComparison: hashComparison,
		CreatedAt:      timestamp,
		VerifierOrg:    callerOrg,
	}

	noteJSON, err := json.Marshal(note)
	if err != nil {
		return fmt.Errorf("failed to marshal verification note: %v", err)
	}

	// Store in private data collection
	noteKey := fmt.Sprintf("note_%s_%s", evidenceId, noteId)
	err = ctx.GetStub().PutPrivateData(VerifierPrivateCollection, noteKey, noteJSON)
	if err != nil {
		return fmt.Errorf("failed to store verification note in PDC: %v", err)
	}

	// Update custody log on public ledger
	evidence, _ := getEvidence(ctx, evidenceId)
	evidence.CustodyLog = append(evidence.CustodyLog, CustodyLog{
		Action:      ActionAddNote,
		ActorOrg:    callerOrg,
		Timestamp:   timestamp,
		Description: "Verification note added (private)",
	})

	return putEvidence(ctx, evidence)
}

// GetVerificationNotes retrieves private verification notes (PDC - VerifierOrg only)
func (c *VerifierContract) GetVerificationNotes(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
) ([]*VerificationNote, error) {
	// Access control
	if err := RequireVerifierOrg(ctx); err != nil {
		return nil, err
	}

	// Query private data collection
	queryString := fmt.Sprintf(`{"selector":{"docType":"verification_note","evidenceId":"%s"}}`, evidenceId)
	resultsIterator, err := ctx.GetStub().GetPrivateDataQueryResult(VerifierPrivateCollection, queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query verification notes: %v", err)
	}
	defer resultsIterator.Close()

	var notes []*VerificationNote
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var note VerificationNote
		if err := json.Unmarshal(queryResult.Value, &note); err != nil {
			return nil, err
		}
		notes = append(notes, &note)
	}

	return notes, nil
}

// =============================================================================
// LEGAL CONTRACT (LegalOrg only)
// =============================================================================

// LegalContract handles legal review and export operations
type LegalContract struct {
	contractapi.Contract
}

// ReviewEvidence marks evidence as under legal review or reviewed
func (c *LegalContract) ReviewEvidence(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
	reviewComplete bool,
) error {
	// Access control
	if err := RequireLegalOrg(ctx); err != nil {
		return err
	}

	evidence, err := getEvidence(ctx, evidenceId)
	if err != nil {
		return err
	}

	// Verify status allows review
	if evidence.Status != StatusVerified && evidence.Status != StatusUnderReview {
		return fmt.Errorf("evidence must be VERIFIED or UNDER_REVIEW to review, current: %s", evidence.Status)
	}

	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()

	var description string
	if reviewComplete {
		evidence.Status = StatusReviewed
		evidence.ReviewedAt = timestamp
		description = "Legal review completed"
	} else {
		evidence.Status = StatusUnderReview
		description = "Legal review started"
	}

	// Add custody log
	evidence.CustodyLog = append(evidence.CustodyLog, CustodyLog{
		Action:      ActionReview,
		ActorOrg:    callerOrg,
		Timestamp:   timestamp,
		Description: description,
	})

	return putEvidence(ctx, evidence)
}

// AddLegalComment adds private legal assessment (PDC - LegalOrg only)
func (c *LegalContract) AddLegalComment(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
	commentId string,
	content string,
	courtReadiness string,
	recommendation string,
) error {
	// Access control
	if err := RequireLegalOrg(ctx); err != nil {
		return err
	}

	// Verify evidence exists
	exists, err := evidenceExists(ctx, evidenceId)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("evidence %s does not exist", evidenceId)
	}

	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()

	// Create legal comment
	comment := LegalComment{
		DocType:          "legal_comment",
		EvidenceID:       evidenceId,
		CommentID:        commentId,
		Content:          content,
		CourtReadiness:   courtReadiness,
		Recommendation:   recommendation,
		CreatedAt:        timestamp,
		LegalReviewerOrg: callerOrg,
	}

	commentJSON, err := json.Marshal(comment)
	if err != nil {
		return fmt.Errorf("failed to marshal legal comment: %v", err)
	}

	// Store in private data collection
	commentKey := fmt.Sprintf("comment_%s_%s", evidenceId, commentId)
	err = ctx.GetStub().PutPrivateData(LegalPrivateCollection, commentKey, commentJSON)
	if err != nil {
		return fmt.Errorf("failed to store legal comment in PDC: %v", err)
	}

	// Update custody log on public ledger
	evidence, _ := getEvidence(ctx, evidenceId)
	evidence.CustodyLog = append(evidence.CustodyLog, CustodyLog{
		Action:      ActionAddComment,
		ActorOrg:    callerOrg,
		Timestamp:   timestamp,
		Description: "Legal comment added (private)",
	})

	return putEvidence(ctx, evidence)
}

// GetLegalComments retrieves private legal comments (PDC - LegalOrg only)
func (c *LegalContract) GetLegalComments(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
) ([]*LegalComment, error) {
	// Access control
	if err := RequireLegalOrg(ctx); err != nil {
		return nil, err
	}

	// Query private data collection
	queryString := fmt.Sprintf(`{"selector":{"docType":"legal_comment","evidenceId":"%s"}}`, evidenceId)
	resultsIterator, err := ctx.GetStub().GetPrivateDataQueryResult(LegalPrivateCollection, queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query legal comments: %v", err)
	}
	defer resultsIterator.Close()

	var comments []*LegalComment
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var comment LegalComment
		if err := json.Unmarshal(queryResult.Value, &comment); err != nil {
			return nil, err
		}
		comments = append(comments, &comment)
	}

	return comments, nil
}

// ExportEvidence generates a court-ready export record
func (c *LegalContract) ExportEvidence(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
) (*ExportRecord, error) {
	// Access control
	if err := RequireLegalOrg(ctx); err != nil {
		return nil, err
	}

	evidence, err := getEvidence(ctx, evidenceId)
	if err != nil {
		return nil, err
	}

	// Verify status allows export
	if evidence.Status != StatusReviewed && evidence.Status != StatusExported {
		return nil, fmt.Errorf("evidence must be REVIEWED to export, current: %s", evidence.Status)
	}

	callerOrg, _ := GetClientOrgID(ctx)
	timestamp := time.Now().Unix()

	// Create export record
	exportRecord := ExportRecord{
		EvidenceID:      evidence.EvidenceID,
		IPFSCID:         evidence.IPFSCID,
		FileHash:        evidence.FileHash,
		FileType:        evidence.FileType,
		Category:        evidence.Category,
		SubmittedAt:     evidence.SubmittedAt,
		VerifiedAt:      evidence.VerifiedAt,
		ReviewedAt:      evidence.ReviewedAt,
		ExportedAt:      timestamp,
		PolygonTxHash:   evidence.PolygonTxHash,
		IntegrityStatus: evidence.IntegrityStatus,
		CustodyLog:      evidence.CustodyLog,
	}

	// Generate hash of export record for integrity
	exportJSON, _ := json.Marshal(exportRecord)
	hash := sha256.Sum256(exportJSON)
	exportRecord.ExportHash = hex.EncodeToString(hash[:])

	// Update evidence status
	evidence.Status = StatusExported
	evidence.ExportedAt = timestamp
	evidence.CustodyLog = append(evidence.CustodyLog, CustodyLog{
		Action:      ActionExport,
		ActorOrg:    callerOrg,
		Timestamp:   timestamp,
		Description: fmt.Sprintf("Evidence exported for court proceedings. Export hash: %s", exportRecord.ExportHash),
	})

	if err := putEvidence(ctx, evidence); err != nil {
		return nil, err
	}

	return &exportRecord, nil
}

// QueryEvidenceByDateRange retrieves evidence within a date range (LegalOrg only)
func (c *LegalContract) QueryEvidenceByDateRange(
	ctx contractapi.TransactionContextInterface,
	startTimestamp int64,
	endTimestamp int64,
	pageSize int32,
	bookmark string,
) (*EvidenceQueryResult, error) {
	// Access control: ONLY LegalOrg can search by date range
	if err := RequireLegalOrg(ctx); err != nil {
		return nil, fmt.Errorf("date range search is restricted to LegalOrg for manual authentication: %v", err)
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "evidence",
			"submittedAt": {
				"$gte": %d,
				"$lte": %d
			}
		},
		"sort": [{"submittedAt": "desc"}]
	}`, startTimestamp, endTimestamp)

	return getQueryResultWithPagination(ctx, queryString, pageSize, bookmark)
}

// =============================================================================
// QUERY CONTRACT (Any Org - Read Only)
// =============================================================================

// QueryContract handles read-only operations accessible by any org
type QueryContract struct {
	contractapi.Contract
}

// GetEvidence retrieves evidence metadata by ID
func (c *QueryContract) GetEvidence(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
) (*Evidence, error) {
	// Access control: any org can read
	if err := RequireAnyOrg(ctx); err != nil {
		return nil, err
	}

	return getEvidence(ctx, evidenceId)
}

// GetAllEvidence retrieves all evidence with pagination
func (c *QueryContract) GetAllEvidence(
	ctx contractapi.TransactionContextInterface,
	pageSize int32,
	bookmark string,
) (*EvidenceQueryResult, error) {
	if err := RequireAnyOrg(ctx); err != nil {
		return nil, err
	}

	queryString := `{"selector":{"docType":"evidence"}}`
	return getQueryResultWithPagination(ctx, queryString, pageSize, bookmark)
}

// QueryEvidenceByStatus retrieves evidence filtered by status
func (c *QueryContract) QueryEvidenceByStatus(
	ctx contractapi.TransactionContextInterface,
	status string,
	pageSize int32,
	bookmark string,
) (*EvidenceQueryResult, error) {
	if err := RequireAnyOrg(ctx); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{"selector":{"docType":"evidence","status":"%s"}}`, status)
	return getQueryResultWithPagination(ctx, queryString, pageSize, bookmark)
}

// QueryEvidenceByCategory retrieves evidence filtered by category
func (c *QueryContract) QueryEvidenceByCategory(
	ctx contractapi.TransactionContextInterface,
	category string,
	pageSize int32,
	bookmark string,
) (*EvidenceQueryResult, error) {
	if err := RequireAnyOrg(ctx); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{"selector":{"docType":"evidence","category":"%s"}}`, category)
	return getQueryResultWithPagination(ctx, queryString, pageSize, bookmark)
}

// QueryEvidenceByBulkSubmission retrieves all evidence from a bulk submission
func (c *QueryContract) QueryEvidenceByBulkSubmission(
	ctx contractapi.TransactionContextInterface,
	bulkSubmissionId string,
) (*EvidenceQueryResult, error) {
	if err := RequireAnyOrg(ctx); err != nil {
		return nil, err
	}

	queryString := fmt.Sprintf(`{"selector":{"docType":"evidence","bulkSubmissionId":"%s"}}`, bulkSubmissionId)
	return getQueryResultWithPagination(ctx, queryString, 100, "")
}

// GetEvidenceCount returns total count of evidence records
func (c *QueryContract) GetEvidenceCount(
	ctx contractapi.TransactionContextInterface,
) (int, error) {
	if err := RequireAnyOrg(ctx); err != nil {
		return 0, err
	}

	queryString := `{"selector":{"docType":"evidence"}}`
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return 0, err
	}
	defer resultsIterator.Close()

	count := 0
	for resultsIterator.HasNext() {
		_, err := resultsIterator.Next()
		if err != nil {
			return 0, err
		}
		count++
	}

	return count, nil
}

// GetEvidenceHistory retrieves complete transaction history for an evidence
func (c *QueryContract) GetEvidenceHistory(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
) (*EvidenceHistory, error) {
	if err := RequireAnyOrg(ctx); err != nil {
		return nil, err
	}

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(evidenceId)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for %s: %v", evidenceId, err)
	}
	defer resultsIterator.Close()

	var history []*HistoryEntry
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		entry := &HistoryEntry{
			TxId:      response.TxId,
			Timestamp: response.Timestamp.Seconds,
			IsDelete:  response.IsDelete,
		}

		if !response.IsDelete {
			var evidence Evidence
			if err := json.Unmarshal(response.Value, &evidence); err != nil {
				return nil, err
			}
			entry.Value = &evidence
		}

		history = append(history, entry)
	}

	return &EvidenceHistory{
		EvidenceID: evidenceId,
		History:    history,
	}, nil
}

// =============================================================================
// HELPER FUNCTIONS (Internal - package level)
// =============================================================================

// evidenceExists checks if evidence exists on the ledger
func evidenceExists(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
) (bool, error) {
	evidenceJSON, err := ctx.GetStub().GetState(evidenceId)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}
	return evidenceJSON != nil, nil
}

// getEvidence internal helper to retrieve evidence
func getEvidence(
	ctx contractapi.TransactionContextInterface,
	evidenceId string,
) (*Evidence, error) {
	evidenceJSON, err := ctx.GetStub().GetState(evidenceId)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence %s: %v", evidenceId, err)
	}
	if evidenceJSON == nil {
		return nil, fmt.Errorf("evidence %s does not exist", evidenceId)
	}

	var evidence Evidence
	if err := json.Unmarshal(evidenceJSON, &evidence); err != nil {
		return nil, fmt.Errorf("failed to unmarshal evidence: %v", err)
	}

	return &evidence, nil
}

// putEvidence internal helper to store evidence
func putEvidence(
	ctx contractapi.TransactionContextInterface,
	evidence *Evidence,
) error {
	evidenceJSON, err := json.Marshal(evidence)
	if err != nil {
		return fmt.Errorf("failed to marshal evidence: %v", err)
	}
	return ctx.GetStub().PutState(evidence.EvidenceID, evidenceJSON)
}

// getQueryResultWithPagination helper for paginated queries
func getQueryResultWithPagination(
	ctx contractapi.TransactionContextInterface,
	queryString string,
	pageSize int32,
	bookmark string,
) (*EvidenceQueryResult, error) {
	resultsIterator, responseMetadata, err := ctx.GetStub().GetQueryResultWithPagination(queryString, pageSize, bookmark)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []*Evidence
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var evidence Evidence
		if err := json.Unmarshal(queryResult.Value, &evidence); err != nil {
			return nil, err
		}
		records = append(records, &evidence)
	}

	return &EvidenceQueryResult{
		Records:             records,
		FetchedRecordsCount: len(records),
		Bookmark:            responseMetadata.Bookmark,
	}, nil
}
