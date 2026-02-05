package main

// =============================================================================
// ChainProof - Data Models
// =============================================================================
// Core data structures for the whistleblowing platform.
// Public data stored on ledger, private data in PDCs.
// =============================================================================

// Evidence represents the core evidence record stored on public ledger
type Evidence struct {
	DocType         string       `json:"docType"`         // "evidence" - for CouchDB queries
	EvidenceID      string       `json:"evidenceId"`      // Unique identifier (UUID)
	IPFSCID         string       `json:"ipfsCid"`         // IPFS Content Identifier
	FileHash        string       `json:"fileHash"`        // SHA256 hash of original file
	FileType        string       `json:"fileType"`        // Type: image, video, audio, document, other
	FileSize        int64        `json:"fileSize"`        // File size in bytes
	Category        string       `json:"category"`        // Optional: financial_fraud, corruption, abuse, harassment, other
	SubmittedAt     int64        `json:"submittedAt"`     // Unix timestamp of submission
	Description     string       `json:"description"`     // User provided description
	Status          string       `json:"status"`          // Current workflow status
	PolygonTxHash   string       `json:"polygonTxHash"`   // Public blockchain anchor (optional)
	PolygonAnchorAt int64        `json:"polygonAnchorAt"` // When anchored to Polygon
	IntegrityStatus string       `json:"integrityStatus"` // PENDING, VERIFIED, FAILED
	VerifiedAt      int64        `json:"verifiedAt"`      // When integrity was verified
	ReviewedAt      int64        `json:"reviewedAt"`      // When legal review completed
	ExportedAt      int64        `json:"exportedAt"`      // When exported for court
	CustodyLog      []CustodyLog `json:"custodyLog"`      // Chain of custody entries
	// Bulk submission support
	BulkSubmissionID string `json:"bulkSubmissionId"` // Groups evidence from same bulk upload
	BulkIndex        int    `json:"bulkIndex"`        // Index within bulk submission
	// Pseudonymous identity support
	PublicKeyHash string `json:"publicKeyHash"` // SHA256 hash of submitter's public key (anonymous identifier)
	Signature     string `json:"signature"`     // Digital signature of evidence hash using private key
	// Rejection info
	RejectionComment string `json:"rejectionComment"` // Comment when integrity fails
}

// Evidence Status Constants
const (
	StatusSubmitted       = "SUBMITTED"        // Initial state after submission
	StatusVerified        = "VERIFIED"         // Integrity check passed
	StatusIntegrityFailed = "INTEGRITY_FAILED" // Integrity check failed (deprecated, use REJECTED)
	StatusRejected        = "REJECTED"         // Integrity check failed, cannot proceed to legal
	StatusUnderReview     = "UNDER_REVIEW"     // Legal team reviewing
	StatusReviewed        = "REVIEWED"         // Legal review complete
	StatusExported        = "EXPORTED"         // Exported for court proceedings
)

// Integrity Status Constants
const (
	IntegrityPending  = "PENDING"  // Not yet verified
	IntegrityVerified = "VERIFIED" // Hash matches
	IntegrityFailed   = "FAILED"   // Hash mismatch
)

// Category Constants (optional field)
const (
	CategoryFinancialFraud = "financial_fraud"
	CategoryCorruption     = "corruption"
	CategoryAbuse          = "abuse"
	CategoryHarassment     = "harassment"
	CategoryEnvironmental  = "environmental"
	CategorySafety         = "safety"
	CategoryOther          = "other"
)

// File Type Constants
const (
	FileTypeImage    = "image"
	FileTypeVideo    = "video"
	FileTypeAudio    = "audio"
	FileTypeDocument = "document"
	FileTypeOther    = "other"
)

// CustodyLog represents a single custody chain entry (public ledger)
type CustodyLog struct {
	Action      string `json:"action"`      // What happened (SUBMIT, VERIFY, REVIEW, etc.)
	ActorOrg    string `json:"actorOrg"`    // Organization MSP ID (not individual identity)
	Timestamp   int64  `json:"timestamp"`   // When the action occurred
	Description string `json:"description"` // Human-readable description
}

// Custody Action Constants
const (
	ActionSubmit       = "SUBMIT"
	ActionBulkSubmit   = "BULK_SUBMIT"
	ActionVerify       = "VERIFY"
	ActionReview       = "REVIEW"
	ActionExport       = "EXPORT"
	ActionAnchor       = "ANCHOR"
	ActionAddNote      = "ADD_NOTE"
	ActionAddComment   = "ADD_COMMENT"
	ActionStatusChange = "STATUS_CHANGE"
)

// =============================================================================
// Bulk Submission Models
// =============================================================================

// BulkEvidenceItem represents a single item in a bulk submission
type BulkEvidenceItem struct {
	EvidenceID string `json:"evidenceId"` // Unique identifier
	IPFSCID    string `json:"ipfsCid"`    // IPFS CID
	FileHash   string `json:"fileHash"`   // SHA256 hash
	FileType   string `json:"fileType"`   // Type of file
	FileSize   int64  `json:"fileSize"`   // Size in bytes
	Category   string `json:"category"`   // Optional category
}

// BulkSubmissionResult holds the result of a bulk submission
type BulkSubmissionResult struct {
	BulkSubmissionID string   `json:"bulkSubmissionId"`
	SubmittedCount   int      `json:"submittedCount"`
	EvidenceIDs      []string `json:"evidenceIds"`
	SubmittedAt      int64    `json:"submittedAt"`
}

// =============================================================================
// Private Data Collection Models
// =============================================================================

// VerificationNote stores private technical notes (VerifierOrg PDC only)
type VerificationNote struct {
	DocType        string `json:"docType"`        // "verification_note"
	EvidenceID     string `json:"evidenceId"`     // Reference to evidence
	NoteID         string `json:"noteId"`         // Unique note identifier
	Content        string `json:"content"`        // Technical notes
	HashComparison string `json:"hashComparison"` // Hash verification details
	CreatedAt      int64  `json:"createdAt"`      // When note was created
	VerifierOrg    string `json:"verifierOrg"`    // Organization that created note
}

// LegalComment stores private legal assessment (LegalOrg PDC only)
type LegalComment struct {
	DocType          string `json:"docType"`          // "legal_comment"
	EvidenceID       string `json:"evidenceId"`       // Reference to evidence
	CommentID        string `json:"commentId"`        // Unique comment identifier
	Content          string `json:"content"`          // Legal assessment text
	CourtReadiness   string `json:"courtReadiness"`   // READY, NOT_READY, NEEDS_REVIEW
	Recommendation   string `json:"recommendation"`   // Legal recommendation
	CreatedAt        int64  `json:"createdAt"`        // When comment was created
	LegalReviewerOrg string `json:"legalReviewerOrg"` // Organization that created comment
}

// Court Readiness Constants
const (
	CourtReady       = "READY"
	CourtNotReady    = "NOT_READY"
	CourtNeedsReview = "NEEDS_REVIEW"
)

// =============================================================================
// Query and Response Models
// =============================================================================

// EvidenceQueryResult holds query results with pagination metadata
type EvidenceQueryResult struct {
	Records             []*Evidence `json:"records"`
	FetchedRecordsCount int         `json:"fetchedRecordsCount"`
	Bookmark            string      `json:"bookmark"` // For pagination
}

// ExportRecord represents a court-ready export package
type ExportRecord struct {
	EvidenceID      string       `json:"evidenceId"`
	IPFSCID         string       `json:"ipfsCid"`
	FileHash        string       `json:"fileHash"`
	FileType        string       `json:"fileType"`
	Category        string       `json:"category"`
	SubmittedAt     int64        `json:"submittedAt"`
	VerifiedAt      int64        `json:"verifiedAt"`
	ReviewedAt      int64        `json:"reviewedAt"`
	ExportedAt      int64        `json:"exportedAt"`
	PolygonTxHash   string       `json:"polygonTxHash"`
	IntegrityStatus string       `json:"integrityStatus"`
	CustodyLog      []CustodyLog `json:"custodyLog"`
	ExportHash      string       `json:"exportHash"` // Hash of this export record
}

// HistoryEntry represents a single ledger history entry
type HistoryEntry struct {
	TxId      string    `json:"txId"`
	Timestamp int64     `json:"timestamp"`
	IsDelete  bool      `json:"isDelete"`
	Value     *Evidence `json:"value"`
}

// EvidenceHistory holds complete transaction history for an evidence
type EvidenceHistory struct {
	EvidenceID string          `json:"evidenceId"`
	History    []*HistoryEntry `json:"history"`
}

// =============================================================================
// Notification System Models (Whistleblower PDC)
// =============================================================================

// Notification stores messages to anonymous whistleblowers (WhistleblowerOrg PDC)
// Addressed by public key hash - nobody knows who holds the corresponding private key
type Notification struct {
	DocType        string `json:"docType"`        // "notification"
	NotificationID string `json:"notificationId"` // Unique identifier
	EvidenceID     string `json:"evidenceId"`     // Related evidence
	PublicKeyHash  string `json:"publicKeyHash"`  // Recipient identifier (anonymous)
	MessageType    string `json:"messageType"`    // Type of notification
	Message        string `json:"message"`        // Human-readable message
	FromOrg        string `json:"fromOrg"`        // Organization sending the notification
	Timestamp      int64  `json:"timestamp"`      // When notification was created
	Read           bool   `json:"read"`           // Whether whistleblower has read it
}

// Notification Type Constants
const (
	NotifyRejection     = "REJECTION"      // Evidence rejected due to integrity failure
	NotifyHashFailure   = "HASH_FAILURE"   // Hash mismatch detected during legal review
	NotifyVerified      = "VERIFIED"       // Evidence successfully verified
	NotifyReviewed      = "REVIEWED"       // Legal review completed
	NotifyExported      = "EXPORTED"       // Evidence exported for court
	NotifyComment       = "COMMENT"        // Comment added by legal team
)

// =============================================================================
// Pseudonymous Reputation Models
// =============================================================================

// Reputation tracks trust score for anonymous whistleblowers by public key hash
type Reputation struct {
	DocType                string `json:"docType"`                // "reputation"
	PublicKeyHash          string `json:"publicKeyHash"`          // Anonymous identifier
	TotalSubmissions       int    `json:"totalSubmissions"`       // Number of submissions
	VerifiedSubmissions    int    `json:"verifiedSubmissions"`    // Submissions that passed verification
	RejectedSubmissions    int    `json:"rejectedSubmissions"`    // Submissions that failed verification
	ExportedSubmissions    int    `json:"exportedSubmissions"`    // Submissions that reached court export
	TrustScore             int    `json:"trustScore"`             // Calculated trust score (0-100)
	FirstSubmissionAt      int64  `json:"firstSubmissionAt"`      // Timestamp of first submission
	LastSubmissionAt       int64  `json:"lastSubmissionAt"`       // Timestamp of last submission
	LastUpdatedAt          int64  `json:"lastUpdatedAt"`          // When reputation was last updated
}

// NotificationQueryResult holds notification query results
type NotificationQueryResult struct {
	Notifications []*Notification `json:"notifications"`
	Count         int             `json:"count"`
}
