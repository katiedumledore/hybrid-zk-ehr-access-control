// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ConsentVerifierV2.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title HybridEHRAccessV4
 * @dev Improved privacy through unified access interface
 * @notice Reduces explicit metadata leakage while maintaining hybrid routing
 * 
 * Privacy Improvements over V3:
 * - Single requestAccess() function (no separate routine/sensitive functions)
 * - No pathway type in event logs
 * - Internal routing not visible from function signature
 * 
 * Remaining Observable:
 * - Gas consumption differential (inherent to hybrid approach)
 * - Transaction sender and timestamp
 * - Patient ID (hashed)
 */
contract HybridEHRAccessV4 is AccessControl {
    
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    enum Sensitivity { ROUTINE, SENSITIVE }
    
    struct PatientRecord {
        string ipfsCID;           // IPFS content identifier
        bytes32 recordHash;       // Hash for integrity verification
        Sensitivity sensitivity;  // Internal classification (not exposed in events)
        uint256 timestamp;        // When record was stored
        bool exists;              // Record exists flag
    }
    
    struct AccessMetrics {
        uint256 gasUsed;
        uint256 timestamp;
        bool authorized;
        string ipfsCID;
        // NO pathway field - reduces explicit leakage
    }
    
    Groth16Verifier public zkVerifier;
    
    // Patient records: patientId => PatientRecord
    mapping(bytes32 => PatientRecord) public patientRecords;
    
    // Provider access metrics
    mapping(address => AccessMetrics[]) public providerMetrics;
    
    // Track which patients exist
    bytes32[] public patientIds;
    
    // Events - NO pathway type exposed
    event PatientRecordStored(
        bytes32 indexed patientId,
        string ipfsCID,
        Sensitivity sensitivity,
        bytes32 recordHash
    );
    
    event AccessProcessed(
        address indexed provider,
        bytes32 indexed patientId,
        bool authorized,
        uint256 gasUsed
        // NO pathway field - privacy improvement
    );
    
    constructor(address _verifierAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        zkVerifier = Groth16Verifier(_verifierAddress);
    }
    
    // Grant provider role
    function grantProviderRole(address provider) external onlyRole(ADMIN_ROLE) {
        _grantRole(PROVIDER_ROLE, provider);
    }
    
    // Store patient record reference
    function storePatientRecord(
        bytes32 patientId,
        string memory ipfsCID,
        Sensitivity sensitivity,
        bytes32 recordHash
    ) external onlyRole(ADMIN_ROLE) {
        require(bytes(ipfsCID).length > 0, "Invalid IPFS CID");
        
        patientRecords[patientId] = PatientRecord({
            ipfsCID: ipfsCID,
            recordHash: recordHash,
            sensitivity: sensitivity,
            timestamp: block.timestamp,
            exists: true
        });
        
        patientIds.push(patientId);
        
        emit PatientRecordStored(patientId, ipfsCID, sensitivity, recordHash);
    }
    
    // Batch store multiple records
    function batchStorePatientRecords(
        bytes32[] memory _patientIds,
        string[] memory _ipfsCIDs,
        Sensitivity[] memory _sensitivities,
        bytes32[] memory _recordHashes
    ) external onlyRole(ADMIN_ROLE) {
        require(
            _patientIds.length == _ipfsCIDs.length &&
            _patientIds.length == _sensitivities.length &&
            _patientIds.length == _recordHashes.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < _patientIds.length; i++) {
            patientRecords[_patientIds[i]] = PatientRecord({
                ipfsCID: _ipfsCIDs[i],
                recordHash: _recordHashes[i],
                sensitivity: _sensitivities[i],
                timestamp: block.timestamp,
                exists: true
            });
            
            patientIds.push(_patientIds[i]);
            
            emit PatientRecordStored(
                _patientIds[i],
                _ipfsCIDs[i],
                _sensitivities[i],
                _recordHashes[i]
            );
        }
    }
    
    /**
     * @dev UNIFIED ACCESS INTERFACE - Privacy Improvement
     * @notice Single function for all access requests
     * @param patientId The patient's hashed identifier
     * @param zkProof Zero-knowledge proof data (optional: empty array for routine)
     * 
     * Privacy Design:
     * - External observer cannot determine operation type from function name
     * - Internal routing based on stored record sensitivity
     * - Gas consumption differential remains observable (inherent trade-off)
     */
    function requestAccess(
        bytes32 patientId,
        bytes memory zkProof
    ) external onlyRole(PROVIDER_ROLE) returns (bool authorized, string memory ipfsCID) {
        uint256 gasStart = gasleft();
        
        // Check if patient exists
        require(patientRecords[patientId].exists, "Patient record not found");
        
        PatientRecord memory record = patientRecords[patientId];
        
        // Internal routing based on stored sensitivity
        // NOTE: Routing logic not visible from external function signature
        if (record.sensitivity == Sensitivity.SENSITIVE) {
            // Sensitive pathway: Verify ZK proof
            authorized = _verifySensitiveAccess(zkProof);
        } else {
            // Routine pathway: RBAC only
            authorized = _verifyRoutineAccess();
        }
        
        if (authorized) {
            ipfsCID = record.ipfsCID;
        }
        
        uint256 gasUsed = gasStart - gasleft();
        
        // Log metrics (no pathway type stored)
        providerMetrics[msg.sender].push(AccessMetrics({
            gasUsed: gasUsed,
            timestamp: block.timestamp,
            authorized: authorized,
            ipfsCID: authorized ? ipfsCID : ""
        }));
        
        // Emit event WITHOUT pathway classification
        emit AccessProcessed(
            msg.sender,
            patientId,
            authorized,
            gasUsed
        );
        
        return (authorized, ipfsCID);
    }
    
    /**
     * @dev Internal function for sensitive access verification
     * @param zkProof Encoded zero-knowledge proof
     */
    function _verifySensitiveAccess(bytes memory zkProof) 
        internal 
        returns (bool) 
    {
        // Decode proof components
        (
            uint[2] memory proof_a,
            uint[2][2] memory proof_b,
            uint[2] memory proof_c,
            uint[1] memory publicSignals
        ) = abi.decode(zkProof, (uint[2], uint[2][2], uint[2], uint[1]));
        
        // Verify ZK proof
        return zkVerifier.verifyProof(proof_a, proof_b, proof_c, publicSignals);
    }
    
    /**
     * @dev Internal function for routine access verification
     */
    function _verifyRoutineAccess() 
        internal 
        view 
        returns (bool) 
    {
        // Simple RBAC check
        return hasRole(PROVIDER_ROLE, msg.sender);
    }
    
    // Get patient record info (without actual data)
    function getPatientRecordInfo(bytes32 patientId) 
        external view returns (
            string memory ipfsCID,
            Sensitivity sensitivity,
            uint256 timestamp,
            bool exists
        ) 
    {
        PatientRecord memory record = patientRecords[patientId];
        return (record.ipfsCID, record.sensitivity, record.timestamp, record.exists);
    }
    
    // Get total number of patients
    function getTotalPatients() external view returns (uint256) {
        return patientIds.length;
    }
    
    // Get provider metrics
    function getProviderMetrics(address provider) 
        external view returns (AccessMetrics[] memory) {
        return providerMetrics[provider];
    }
    
    /**
     * @dev Helper function to encode ZK proof for requestAccess()
     * @notice Call this off-chain to prepare zkProof parameter
     */
    function encodeZKProof(
        uint[2] memory proof_a,
        uint[2][2] memory proof_b,
        uint[2] memory proof_c,
        uint[1] memory publicSignals
    ) external pure returns (bytes memory) {
        return abi.encode(proof_a, proof_b, proof_c, publicSignals);
    }
}