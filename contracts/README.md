# Smart Contracts Documentation

Solidity smart contracts for hybrid zero-knowledge EHR access control.

## 📋 Contract Overview

| Contract | Purpose | Gas (Routine) | Gas (Sensitive) | Size |
|----------|---------|---------------|-----------------|------|
| **AllNonZKAccess.sol** | Pure RBAC baseline | 183,907 | - | 6.1 KB |
| **HybridEHRAccessV4.sol** | Hybrid selective ZK | 182,513 | 15,995,860 | 8.8 KB |
| **AllZKAccess.sol** | Universal ZK approach | - | 16,022,612 | 5.9 KB |
| **ConsentVerifierV2.sol** | ZK proof verifier | - | - | 7.2 KB |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Request                       │
│            requestAccess(patientId, proof)           │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
    ┌────▼─────┐        ┌────▼──────┐
    │ Routine  │        │ Sensitive │
    │  RBAC    │        │ ZK Proof  │
    │ 183K gas │        │  16M gas  │
    └──────────┘        └───────────┘
```

---

## 📝 AllNonZKAccess.sol

**Purpose:** Baseline implementation using pure role-based access control.

### Key Features
- ✅ Simple RBAC with role mapping
- ✅ On-chain patient registration
- ✅ IPFS hash storage for off-chain data
- ✅ Owner-controlled patient registration
- ✅ Public access verification (anyone with valid role)

### Core Functions

```solidity
// Register new patient
function registerPatient(
    bytes32 patientId, 
    string calldata ipfsHash
) external onlyOwner

// Request access (RBAC only)
function requestAccess(bytes32 patientId) 
    external returns (bool)

// Query patient data
function getPatientIPFSHash(bytes32 patientId) 
    external view returns (string memory)

function isPatientRegistered(bytes32 patientId) 
    external view returns (bool)
```

### Storage Structure

```solidity
struct PatientRecord {
    string ipfsHash;        // IPFS CID for off-chain data
    bool exists;            // Registration flag
    uint256 timestamp;      // Registration timestamp
}

mapping(bytes32 => PatientRecord) public patients;
mapping(address => bool) public authorizedProviders;
```

### Gas Consumption
- **Registration:** ~91,000 gas
- **Access Request:** ~183,907 gas (testnet average)
- **Query:** ~24,000 gas

### Deployment
```bash
npx hardhat run scripts/deploy-allnonzk.js --network localhost
# Testnet
node scripts/testnet/deploy-allnonzk-testnet.js
```

**Deployed (Sepolia):** `0x28472d124F9eBd34DfacD7b11eDe80E12fc337e1`

---

## 🔐 HybridEHRAccessV4.sol

**Purpose:** Hybrid approach with sensitivity-based routing.

### Key Features
- ✅ Unified `requestAccess()` interface
- ✅ Sensitivity-based cryptographic routing
- ✅ ZK proof verification for sensitive data
- ✅ Lightweight RBAC for routine data
- ✅ Zero-knowledge consent verification

### Core Functions

```solidity
// Register patient with sensitivity flag
function registerPatient(
    bytes32 patientId,
    string calldata ipfsHash,
    bool isSensitive
) external onlyOwner

// Unified access request
function requestAccess(
    bytes32 patientId,
    bytes calldata proof
) external returns (bool)

// Check sensitivity level
function isPatientSensitive(bytes32 patientId) 
    external view returns (bool)
```

### Architecture Flow

```
requestAccess(patientId, proof)
         │
         ├─→ Check: isPatientSensitive?
         │
    ┌────┴────┐
    │         │
   YES       NO
    │         │
    ▼         ▼
Verify ZK   RBAC
 16M gas   183K gas
```

### Storage Structure

```solidity
struct SensitivePatientRecord {
    string ipfsHash;
    bool isSensitive;       // Sensitivity flag
    bool exists;
    uint256 timestamp;
}

mapping(bytes32 => SensitivePatientRecord) public patients;
ConsentVerifierV2 public verifier;  // ZK verifier contract
```

### Gas Consumption
- **Routine Access:** ~182,513 gas (98.9% cheaper than AllZK)
- **Sensitive Access:** ~15,995,860 gas (ZK proof verification)
- **Gas Differential:** 87.6×

### Privacy Metrics
- **Mutual Information:** 1.0 bits (pathway distinguishable)
- **Privacy Budget (ε):** 4.4733
- **Content Privacy:** Cryptographically protected via ZK

### Deployment
```bash
npx hardhat run scripts/deploy-hybrid.js --network localhost
# Testnet
node scripts/testnet/deploy-hybrid-v4-testnet.js
```

**Deployed (Sepolia):** `0x620f15963721bEA41ceEA5688b5223b340F1B867`

---

## 🛡️ AllZKAccess.sol

**Purpose:** Maximum privacy with universal zero-knowledge proofs.

### Key Features
- ✅ All operations require ZK proof
- ✅ Perfect privacy (ε = 0, MI = 0)
- ✅ No metadata leakage
- ✅ Highest security, highest cost

### Core Functions

```solidity
// Register patient
function registerPatient(
    bytes32 patientId,
    string calldata ipfsHash
) external onlyOwner

// Request access (requires valid ZK proof)
function requestAccess(
    bytes32 patientId,
    uint256[2] calldata proof_a,
    uint256[2][2] calldata proof_b,
    uint256[2] calldata proof_c,
    uint256[1] calldata publicSignals
) external returns (bool)
```

### Gas Consumption
- **All Operations:** ~16,022,612 gas
- **Annual Cost (10K daily):** $15.95B (at 50 gwei, $3000 ETH)
- **Daily Capacity:** 133,000 operations

### Privacy Metrics
- **Mutual Information:** 0 bits (perfect privacy)
- **Privacy Budget (ε):** 0.0000
- **Pathway Distinguishability:** None

### Deployment
```bash
npx hardhat run scripts/deploy-allzk.js --network localhost
# Testnet
node scripts/testnet/deploy-allzk-testnet.js
```

**Deployed (Sepolia):** `0x75E5bBaF31E489E12D7Be680b4D985108f22a7C8`

---

## 🔬 ConsentVerifierV2.sol

**Purpose:** Groth16 zero-knowledge proof verifier.

### Key Features
- ✅ Generated by snarkjs from Circom circuit
- ✅ 7,281 constraints
- ✅ Verifies consent proofs on-chain
- ✅ Pairing-based cryptography

### Core Function

```solidity
function verifyProof(
    uint256[2] calldata _pA,
    uint256[2][2] calldata _pB,
    uint256[2] calldata _pC,
    uint256[1] calldata _pubSignals
) public view returns (bool)
```

### Technical Details
- **Curve:** BN254 (alt_bn128)
- **Proof System:** Groth16
- **Verification Time:** ~0.02s on-chain
- **Gas Cost:** ~290,000 gas (included in 16M total)

### Integration

Used by `HybridEHRAccessV4.sol` and `AllZKAccess.sol`:

```solidity
bool isValid = verifier.verifyProof(
    proof_a, proof_b, proof_c, publicSignals
);
require(isValid, "Invalid zero-knowledge proof");
```

---

## 📊 Comparative Analysis

### Gas Consumption (Testnet Results)

| Operation | AllNonZK | HybridV4 | AllZK |
|-----------|----------|----------|-------|
| Routine | 183,907 | 182,513 | - |
| Sensitive | - | 15,995,860 | 16,022,612 |
| Coefficient of Variation | 0.0000% | 0.0000% | 0.0012% |

### Economic Impact (70/30 workload, 10K daily ops)

| Model | Annual Cost | Savings vs AllZK |
|-------|-------------|------------------|
| AllNonZK | $101M | 99.4% |
| HybridV4 | $4.86B | 69.5% |
| AllZK | $15.95B | - |

### Privacy vs Performance

| Model | Privacy (ε) | MI (bits) | Gas Efficiency |
|-------|-------------|-----------|----------------|
| AllNonZK | N/A | 0 | Highest |
| HybridV4 | 4.4733 | 1.0 | Medium |
| AllZK | 0.0000 | 0 | Lowest |

---

## 🔧 Development

### Compilation

```bash
npx hardhat compile
```

### Testing

```bash
npx hardhat test
REPORT_GAS=true npx hardhat test
```

### Local Deployment

```bash
# Start local node
npx hardhat node

# Deploy all contracts
npx hardhat run scripts/deploy-allnonzk.js --network localhost
npx hardhat run scripts/deploy-hybrid.js --network localhost
npx hardhat run scripts/deploy-allzk.js --network localhost
```

### Testnet Deployment

```bash
# Set environment variables in .env
ALCHEMY_API_KEY=...
PRIVATE_KEY=...

# Deploy
node scripts/testnet/deploy-all-testnet.js

# Verify on Etherscan (optional)
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

---

## 🔐 Security Considerations

### Access Control
- Owner-only patient registration
- Public access verification (anyone can request if authorized)
- No role revocation (simplified for research)

### Known Limitations
1. **Single Point of Failure:** Private key compromise affects all operations
2. **No Defense-in-Depth:** Same key for routine and sensitive access
3. **Gas Pattern Leakage:** HybridV4 reveals operation type through gas
4. **Proof Reuse:** Demo uses single proof for all patients
5. **No Audit:** Research code, not production-ready

### Mitigation Strategies
- Use hardware wallets / HSMs for key storage
- Implement multi-sig for critical operations
- Add time-locks for sensitive data access
- Obfuscate gas patterns via padding
- Production deployment requires full security audit

---

## 📚 Dependencies

```json
{
  "@openzeppelin/contracts": "^4.9.3",
  "hardhat": "^2.17.0",
  "ethers": "^6.7.0"
}
```

### OpenZeppelin Contracts Used
- `Ownable.sol` - Access control
- `ReentrancyGuard.sol` - Protection against reentrancy

---

## 🧪 Testing Checklist

- [ ] Patient registration works
- [ ] Access requests succeed with valid credentials
- [ ] ZK proof verification works (HybridV4, AllZK)
- [ ] IPFS hash retrieval correct
- [ ] Owner-only functions restricted
- [ ] Gas consumption within expected ranges
- [ ] Events emitted correctly

---

## 📖 API Reference

### Events

```solidity
event PatientRegistered(bytes32 indexed patientId, uint256 timestamp);
event AccessGranted(bytes32 indexed patientId, address indexed provider, uint256 timestamp);
event AccessDenied(bytes32 indexed patientId, address indexed provider, uint256 timestamp);
```

### Modifiers

```solidity
modifier onlyOwner()
modifier nonReentrant()
modifier patientExists(bytes32 patientId)
```

---

## 🔗 Related Documentation

- [Circuit Documentation](../circuits/README.md)
- [Benchmark Results](../data/benchmarks/README.md)
- [Main README](../README.md)


---

## 🤝 Contributing

This is academic research. For questions: kirthifb1@gmail.com