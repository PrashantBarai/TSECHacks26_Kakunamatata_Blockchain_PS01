// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChainProofAnchor
 * @dev Immutable timestamp anchoring for ChainProof evidence on Sepolia/Polygon
 * 
 * Deploy via Remix:
 * 1. Go to https://remix.ethereum.org
 * 2. Create new file: ChainProofAnchor.sol
 * 3. Paste this code
 * 4. Compile with Solidity 0.8.19+
 * 5. Deploy to Sepolia (use MetaMask with Sepolia testnet)
 * 6. Copy contract address to backend .env
 */
contract ChainProofAnchor {
    
    // Anchor structure
    struct Anchor {
        bytes32 fileHash;       // SHA256 hash of the evidence file
        uint256 timestamp;      // Block timestamp when anchored
        address submitter;      // Address that submitted the anchor
        bool exists;            // Existence flag
    }
    
    // Mapping: evidenceId (bytes32) => Anchor
    mapping(bytes32 => Anchor) public anchors;
    
    // Events
    event HashAnchored(
        bytes32 indexed evidenceId,
        bytes32 indexed fileHash,
        uint256 timestamp,
        address submitter
    );
    
    event AnchorVerified(
        bytes32 indexed evidenceId,
        bool valid,
        bytes32 storedHash,
        bytes32 providedHash
    );
    
    /**
     * @dev Anchor a file hash for an evidence ID
     * @param evidenceId Unique identifier for the evidence (keccak256 of evidence ID string)
     * @param fileHash SHA256 hash of the evidence file
     */
    function anchorHash(bytes32 evidenceId, bytes32 fileHash) external {
        require(!anchors[evidenceId].exists, "ChainProofAnchor: Evidence already anchored");
        require(fileHash != bytes32(0), "ChainProofAnchor: Invalid file hash");
        
        anchors[evidenceId] = Anchor({
            fileHash: fileHash,
            timestamp: block.timestamp,
            submitter: msg.sender,
            exists: true
        });
        
        emit HashAnchored(evidenceId, fileHash, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Get anchor details for an evidence ID
     * @param evidenceId The evidence ID to look up
     * @return fileHash The stored file hash
     * @return timestamp When the anchor was created
     * @return submitter Address that created the anchor
     */
    function getAnchor(bytes32 evidenceId) external view returns (
        bytes32 fileHash,
        uint256 timestamp,
        address submitter
    ) {
        require(anchors[evidenceId].exists, "ChainProofAnchor: Evidence not found");
        Anchor memory anchor = anchors[evidenceId];
        return (anchor.fileHash, anchor.timestamp, anchor.submitter);
    }
    
    /**
     * @dev Verify if a file hash matches the anchored hash
     * @param evidenceId The evidence ID to verify
     * @param fileHashToVerify The hash to compare against stored hash
     * @return valid Whether the hashes match
     * @return storedHash The originally anchored hash
     * @return anchorTimestamp When the anchor was created
     */
    function verifyHash(bytes32 evidenceId, bytes32 fileHashToVerify) external view returns (
        bool valid,
        bytes32 storedHash,
        uint256 anchorTimestamp
    ) {
        require(anchors[evidenceId].exists, "ChainProofAnchor: Evidence not found");
        Anchor memory anchor = anchors[evidenceId];
        
        valid = (anchor.fileHash == fileHashToVerify);
        storedHash = anchor.fileHash;
        anchorTimestamp = anchor.timestamp;
        
        return (valid, storedHash, anchorTimestamp);
    }
    
    /**
     * @dev Check if an evidence ID has been anchored
     * @param evidenceId The evidence ID to check
     * @return exists Whether the evidence has been anchored
     */
    function isAnchored(bytes32 evidenceId) external view returns (bool) {
        return anchors[evidenceId].exists;
    }
    
    /**
     * @dev Helper to convert string evidence ID to bytes32
     * @param evidenceIdString The string evidence ID
     * @return The keccak256 hash as bytes32
     */
    function stringToBytes32(string memory evidenceIdString) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(evidenceIdString));
    }
}
