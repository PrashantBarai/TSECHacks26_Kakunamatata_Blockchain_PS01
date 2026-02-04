# ChainProof Chaincode Testing Guide

This guide provides a sequential flow to test all features of the ChainProof smart contract.
Execute these commands from the `ChainProof` directory where `deploy_chaincode.sh` is located.

**Prerequisites:**
- Chaincode deployed (`chainproof`) on channel `chainproof-channel`.
- Environment uses Microfab on port `7070`.

---

## 1. Setup Environment Variables
Before running commands, it's easiest to set these variables once per terminal session, or just copy the full commands below.

**Global Vars:**
```bash
export ORDERER="orderer-api.127-0-0-1.nip.io:7070"
export CHANNEL="chainproof-channel"
export CC_NAME="chainproof"
```

**Peer Addresses:**
- Whistleblower: `whistleblowersorgpeer-api.127-0-0-1.nip.io:7070`
- Verifier: `verifierorgpeer-api.127-0-0-1.nip.io:7070`
- Legal: `legalorgpeer-api.127-0-0-1.nip.io:7070`

---

## 2. Whistleblower Workflow (Submit Evidence)

**Context:** Switch to Whistleblower Org
```bash
source ./deploy_chaincode.sh switch whistleblower
```

### 2.1 Submit Single Evidence (with Pseudonymous Identity)
*Function: `WhistleblowerContract:SubmitEvidence`*
*New parameters: `publicKeyHash` (SHA256 of user's public key) and `signature` (signed file hash)*

```bash
# Example publicKeyHash - in real usage, this comes from client-side keypair
export PUBLIC_KEY_HASH="a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
export SIGNATURE="MEUCIQDbase64signaturehere..."

peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
  -c "{\"function\":\"WhistleblowerContract:SubmitEvidence\",\"Args\":[\"EVD101\",\"QmHash123\",\"fileHashABC\",\"pdf\",\"1024\",\"corruption\",\"$PUBLIC_KEY_HASH\",\"$SIGNATURE\"]}"
```

### 2.2 Submit Bulk Evidence
*Function: `WhistleblowerContract:SubmitBulkEvidence`*

```bash
# JSON array of items
export BULK_ITEMS='[{"evidenceId":"EVD102","ipfsCid":"QmBulk1","fileHash":"hash1","fileType":"jpg","fileSize":500,"category":"fraud"},{"evidenceId":"EVD103","ipfsCid":"QmBulk2","fileHash":"hash2","fileType":"mp4","fileSize":2000,"category":"fraud"}]'

peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
  -c "{\"function\":\"WhistleblowerContract:SubmitBulkEvidence\",\"Args\":[\"BULK001\",$BULK_ITEMS]}"
```

### 2.3 Verify Submission (Query)
*Function: `QueryContract:GetEvidence`*

```bash
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c '{"function":"QueryContract:GetEvidence","Args":["EVD101"]}'
```

### 2.4 Update Polygon Anchor (Optional)
*Function: `WhistleblowerContract:UpdatePolygonAnchor`*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"WhistleblowerContract:UpdatePolygonAnchor","Args":["EVD101","0xPolygonTxHash123"]}'
```

### 2.5 Get Notifications (NEW)
*Function: `WhistleblowerContract:GetNotifications`*
*Retrieves all notifications for a given publicKeyHash (verification results, rejections, etc.)*

```bash
# Use the same publicKeyHash from submission
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c "{\"function\":\"WhistleblowerContract:GetNotifications\",\"Args\":[\"$PUBLIC_KEY_HASH\"]}"
```

### 2.6 Get Reputation Score (NEW)
*Function: `WhistleblowerContract:GetReputation`*
*Returns trust score and submission statistics for a publicKeyHash*

```bash
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c "{\"function\":\"WhistleblowerContract:GetReputation\",\"Args\":[\"$PUBLIC_KEY_HASH\"]}"
```

### 2.7 Mark Notification Read (NEW)
*Function: `WhistleblowerContract:MarkNotificationRead`*
*Marks a specific notification as read*

```bash
# Replace NOTIF_ID with actual notification ID from GetNotifications
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"WhistleblowerContract:MarkNotificationRead","Args":["notif_EVD101_1234567890"]}'
```

---

## 3. Verifier Workflow (Integrity Check)

**Context:** Switch to Verifier Org
```bash
source ./deploy_chaincode.sh switch verifier
```

### 3.1 Verify Integrity (Pass)
*Function: `VerifierContract:VerifyIntegrity`*
*Args: `evidenceId`, `computedHash`, `passed` (bool), `rejectionComment` (empty for pass)*

```bash
# Successful verification - hashes match
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses verifierorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"VerifierContract:VerifyIntegrity","Args":["EVD101","fileHashABC","true",""]}'
```

### 3.1b Verify Integrity (FAIL - Rejection)
*If hashes don't match, evidence is REJECTED and whistleblower is notified*
*⚠️ `rejectionComment` is REQUIRED when `passed=false`*

```bash
# Failed verification - evidence will be REJECTED (does NOT go to Legal)
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses verifierorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"VerifierContract:VerifyIntegrity","Args":["EVD102","wrongHash","false","Computed hash does not match stored hash. File may have been altered."]}'
```

### 3.2 Add Verification Note (Private Data)
*Function: `VerifierContract:AddVerificationNote`*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses verifierorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"VerifierContract:AddVerificationNote","Args":["EVD101","NOTE001","Hashes match perfectly. Metadata verified.","Match"]}'
```

### 3.3 Read Verification Notes (Private)
*Function: `VerifierContract:GetVerificationNotes`*

```bash
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c '{"function":"VerifierContract:GetVerificationNotes","Args":["EVD101"]}'
```

---

## 4. Legal Workflow (Review & Export)

**Context:** Switch to Legal Org
```bash
source ./deploy_chaincode.sh switch legal
```

### 4.1 Start Legal Review
*Function: `LegalContract:ReviewEvidence`*
*Note: Second arg `false` starts review, `true` completes it.*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses legalorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"LegalContract:ReviewEvidence","Args":["EVD101","false"]}'
```

### 4.2 Add Legal Comment (Private Data)
*Function: `LegalContract:AddLegalComment`*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses legalorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"LegalContract:AddLegalComment","Args":["EVD101","COM001","Evidence is admissible. Clear chain of custody.","Ready","Proceed"]}'
```

### 4.3 Complete Review
*Function: `LegalContract:ReviewEvidence`*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses legalorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"LegalContract:ReviewEvidence","Args":["EVD101","true"]}'
```

### 4.4 Export Evidence (Court Ready)
*Function: `LegalContract:ExportEvidence`*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses legalorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"LegalContract:ExportEvidence","Args":["EVD101"]}'
```

### 4.5 Search by Date (Legal Only)
*Function: `LegalContract:QueryEvidenceByDateRange`*

```bash
# Timestamps are Unix Epoch seconds. Example: Search last 24 hours.
START_TIME=$(date -d 'yesterday' +%s)
END_TIME=$(date +%s)

peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c "{\"function\":\"LegalContract:QueryEvidenceByDateRange\",\"Args\":[\"$START_TIME\",\"$END_TIME\",\"10\",\"\"]}"
```

---

## 5. Public Queries (Any Org)

**Context:** Any org context (e.g., switch back to whistleblower)
```bash
source ./deploy_chaincode.sh switch whistleblower
```

### 5.1 Get Evidence Details
*Function: `QueryContract:GetEvidence`*

```bash
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c '{"function":"QueryContract:GetEvidence","Args":["EVD101"]}'
```

### 5.2 Get History (Audit Trail)
*Function: `QueryContract:GetEvidenceHistory`*

```bash
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c '{"function":"QueryContract:GetEvidenceHistory","Args":["EVD101"]}'
```

### 5.3 Filter by Status
*Function: `QueryContract:QueryEvidenceByStatus`*

```bash
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c '{"function":"QueryContract:QueryEvidenceByStatus","Args":["EXPORTED","10",""]}'
```

### 5.4 Query Rejected Evidence (NEW)
*Check all evidence that failed verification*

```bash
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c '{"function":"QueryContract:QueryEvidenceByStatus","Args":["REJECTED","10",""]}'
```

---

## 6. Complete Flow Testing (NEW)

This section demonstrates the complete flow including the new pseudonymous identity and rejection notification features.

### 6.1 Happy Path: Submit → Verify → Review → Export

```bash
# Step 1: Set up identity
export PUBLIC_KEY_HASH="testuser123456789abcdef"
export SIGNATURE="testSignature"

# Step 2: Submit as Whistleblower
source ./deploy_chaincode.sh switch whistleblower
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
  -c "{\"function\":\"WhistleblowerContract:SubmitEvidence\",\"Args\":[\"EVD-FLOW-1\",\"QmTestCid\",\"correctHashABC\",\"pdf\",\"1024\",\"corruption\",\"$PUBLIC_KEY_HASH\",\"$SIGNATURE\"]}"

# Step 3: Verify as Verifier (PASS)
source ./deploy_chaincode.sh switch verifier
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses verifierorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"VerifierContract:VerifyIntegrity","Args":["EVD-FLOW-1","correctHashABC","true",""]}'

# Step 4: Check notification was sent
source ./deploy_chaincode.sh switch whistleblower
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c "{\"function\":\"WhistleblowerContract:GetNotifications\",\"Args\":[\"$PUBLIC_KEY_HASH\"]}"

# Step 5: Review as Legal
source ./deploy_chaincode.sh switch legal
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses legalorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"LegalContract:ReviewEvidence","Args":["EVD-FLOW-1","true"]}'

# Step 6: Check reputation increase
source ./deploy_chaincode.sh switch whistleblower
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c "{\"function\":\"WhistleblowerContract:GetReputation\",\"Args\":[\"$PUBLIC_KEY_HASH\"]}"
```

### 6.2 Rejection Path: Submit → Fail Verification → Notification

```bash
# Step 1: Submit evidence with wrong hash
source ./deploy_chaincode.sh switch whistleblower
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
  -c "{\"function\":\"WhistleblowerContract:SubmitEvidence\",\"Args\":[\"EVD-REJECT-1\",\"QmBadCid\",\"claimedHashXYZ\",\"pdf\",\"1024\",\"fraud\",\"$PUBLIC_KEY_HASH\",\"$SIGNATURE\"]}"

# Step 2: Verifier finds hash mismatch → REJECT
source ./deploy_chaincode.sh switch verifier
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses verifierorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"VerifierContract:VerifyIntegrity","Args":["EVD-REJECT-1","actualHashDifferent","false","File hash mismatch detected. Claimed: claimedHashXYZ, Actual: actualHashDifferent. Evidence may be corrupted."]}'

# Step 3: Evidence should now be REJECTED (not proceed to Legal)
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c '{"function":"QueryContract:GetEvidence","Args":["EVD-REJECT-1"]}'
# Expected: status=REJECTED, integrityStatus=FAILED, rejectionComment populated

# Step 4: Whistleblower receives rejection notification
source ./deploy_chaincode.sh switch whistleblower
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c "{\"function\":\"WhistleblowerContract:GetNotifications\",\"Args\":[\"$PUBLIC_KEY_HASH\"]}"
# Expected: notification with type=REJECTION and the rejection message

# Step 5: Check reputation decreased
peer chaincode query -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  -c "{\"function\":\"WhistleblowerContract:GetReputation\",\"Args\":[\"$PUBLIC_KEY_HASH\"]}"
# Expected: rejectedSubmissions increased, trustScore decreased
```
