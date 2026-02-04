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

### 2.1 Submit Single Evidence
*Function: `WhistleblowerContract:SubmitEvidence`*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"WhistleblowerContract:SubmitEvidence","Args":["EVD101","QmHash123","fileHashABC","pdf","1024","corruption"]}'
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

---

## 3. Verifier Workflow (Integrity Check)

**Context:** Switch to Verifier Org
```bash
source ./deploy_chaincode.sh switch verifier
```

### 3.1 Verify Integrity
*Function: `VerifierContract:VerifyIntegrity`*
*Note: Pass `true` if hashes match, `false` otherwise.*

```bash
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:7070 \
  --channelID chainproof-channel -n chainproof \
  --peerAddresses verifierorgpeer-api.127-0-0-1.nip.io:7070 \
  -c '{"function":"VerifierContract:VerifyIntegrity","Args":["EVD101","fileHashABC","true"]}'
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
