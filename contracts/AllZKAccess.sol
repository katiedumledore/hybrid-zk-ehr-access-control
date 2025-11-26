// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import the generated ZK verifier
import "./ConsentVerifierV2.sol";

/**
 * @title AllZKAccess
 * @dev All-ZK baseline - REQUIRES zero-knowledge proofs for EVERYTHING
 * @notice Both sensitive AND routine operations require ZK proof verification
 */
contract AllZKAccess {
    
    Groth16Verifier public zkVerifier;
    address public admin;
    
    enum Sensitivity { ROUTINE, SENSITIVE }
    
    struct PatientRecord {
        string ipfsCID;
        bytes32 recordHash;
        Sensitivity sensitivity;
        uint256 timestamp;
        bool exists;
    }
    
    struct AccessMetrics {
        uint256 gasUsed;
        uint256 timestamp;
        Sensitivity recordType;
        bool authorized;
        string ipfsCID;
        uint256 zkProofVerified;  // Track ZK verification
    }
    
    mapping(bytes32 => PatientRecord) public patientRecords;
    mapping(address => AccessMetrics[]) public providerMetrics;
    bytes32[] public patientIds;
    
    event PatientRecordStored(
        bytes32 indexed patientId,
        string ipfsCID,
        Sensitivity sensitivity,
        bytes32 recordHash
    );
    
    event ZKAccessProcessed(
        address indexed provider,
        bytes32 indexed patientId,
        Sensitivity recordType,
        uint256 gasUsed,
        bool zkProofValid,
        string ipfsCID
    );
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    constructor(address _zkVerifier) {
        zkVerifier = Groth16Verifier(_zkVerifier);
        admin = msg.sender;
    }
    
    /**
     * @dev Store patient record reference
     */
    function storePatientRecord(
        bytes32 patientId,
        string memory ipfsCID,
        Sensitivity sensitivity,
        bytes32 recordHash
    ) external onlyAdmin {
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
    
    /**
     * @dev Batch store multiple records
     */
    function batchStorePatientRecords(
        bytes32[] memory _patientIds,
        string[] memory _ipfsCIDs,
        Sensitivity[] memory _sensitivities,
        bytes32[] memory _recordHashes
    ) external onlyAdmin {
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
     * @dev Request access using ZK PROOF (for BOTH routine AND sensitive)
     * @notice This is the ONLY access method - no RBAC fallback
     */
    function requestAccess(
        bytes32 patientId,
        uint[2] memory proof_a,
        uint[2][2] memory proof_b,
        uint[2] memory proof_c,
        uint[1] memory publicSignals
    ) external returns (bool authorized, string memory ipfsCID) {
        uint256 gasStart = gasleft();
        
        require(patientRecords[patientId].exists, "Patient record not found");
        
        PatientRecord memory record = patientRecords[patientId];
        
        // *** CRITICAL: ZK PROOF VERIFICATION FOR ALL ACCESS ***
        bool zkProofValid = zkVerifier.verifyProof(
            proof_a,
            proof_b,
            proof_c,
            publicSignals
        );
        
        authorized = zkProofValid;
        
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
            ipfsCID: authorized ? ipfsCID : "",
            zkProofVerified: zkProofValid ? 1 : 0
        }));
        
        emit ZKAccessProcessed(
            msg.sender,
            patientId,
            record.sensitivity,
            gasUsed,
            zkProofValid,
            ipfsCID
        );
        
        return (authorized, ipfsCID);
    }
    
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
    
    function getTotalPatients() external view returns (uint256) {
        return patientIds.length;
    }
    
    function getProviderMetrics(address provider) 
        external view returns (AccessMetrics[] memory) {
        return providerMetrics[provider];
    }
}