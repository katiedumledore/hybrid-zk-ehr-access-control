// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AllNonZKAccess
 * @dev Pure RBAC baseline - NO zero-knowledge proofs
 * @notice All access control via roles only (sensitive + routine)
 */
contract AllNonZKAccess is AccessControl {
    
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    enum Sensitivity { ROUTINE, SENSITIVE }
    
    struct PatientRecord {
        string ipfsCID;           // IPFS content identifier
        bytes32 recordHash;       // Record hash for integrity
        Sensitivity sensitivity;  // Routine or Sensitive
        uint256 timestamp;        // When record was stored
        bool exists;              // Record exists flag
    }
    
    struct AccessMetrics {
        uint256 gasUsed;
        uint256 timestamp;
        Sensitivity recordType;
        bool authorized;
        string ipfsCID;
    }
    
    // Patient records: patientId => PatientRecord
    mapping(bytes32 => PatientRecord) public patientRecords;
    
    // Provider access metrics
    mapping(address => AccessMetrics[]) public providerMetrics;
    
    // Track which patients exist
    bytes32[] public patientIds;
    
    // Events
    event PatientRecordStored(
        bytes32 indexed patientId,
        string ipfsCID,
        Sensitivity sensitivity,
        bytes32 recordHash
    );
    
    event AccessProcessed(
        address indexed provider,
        bytes32 indexed patientId,
        Sensitivity recordType,
        uint256 gasUsed,
        bool authorized,
        string ipfsCID
    );
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    // Grant provider role
    function grantProviderRole(address provider) external onlyRole(ADMIN_ROLE) {
        _grantRole(PROVIDER_ROLE, provider);
    }
    
    // Store patient record reference (IPFS CID only)
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
     * @dev Request access to ANY patient record (routine OR sensitive)
     * @notice Uses ONLY role-based access control (no ZK proofs)
     */
    function requestAccess(
        bytes32 patientId
    ) external onlyRole(PROVIDER_ROLE) returns (bool authorized, string memory ipfsCID) {
        uint256 gasStart = gasleft();
        
        // Check if patient exists
        require(patientRecords[patientId].exists, "Patient record not found");
        
        PatientRecord memory record = patientRecords[patientId];
        
        // Simple RBAC check (same for BOTH routine and sensitive)
        authorized = hasRole(PROVIDER_ROLE, msg.sender);
        
        if (authorized) {
            ipfsCID = record.ipfsCID;
        }
        
        uint256 gasUsed = gasStart - gasleft();
        
        // Log metrics
        providerMetrics[msg.sender].push(AccessMetrics({
            gasUsed: gasUsed,
            timestamp: block.timestamp,
            recordType: record.sensitivity,
            authorized: authorized,
            ipfsCID: authorized ? ipfsCID : ""
        }));
        
        emit AccessProcessed(
            msg.sender,
            patientId,
            record.sensitivity,
            gasUsed,
            authorized,
            ipfsCID
        );
        
        return (authorized, ipfsCID);
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
}