# Hybrid Zero-Knowledge Proof System for EHR Access Control

[![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-blue)](https://sepolia.etherscan.io/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)](https://hardhat.org/)

> MSc Dissertation: Optimizing Privacy-Preserving Healthcare Data Access Through Hybrid Zero-Knowledge and Conventional Cryptographic Approaches

## 📋 Overview

This research addresses the critical trade-off between computational efficiency and metadata privacy protection in blockchain-based Electronic Health Record (EHR) access control systems. The hybrid approach combines:

- **Zero-Knowledge Proofs** for sensitive consent verification (mental health, substance abuse, genetic testing)
- **Lightweight RBAC** for routine authorization checks (vital signs, medications, lab results)

### Key Findings

| Metric | Value | Significance |
|--------|-------|--------------|
| **Gas Differential** | 87.6× | Sensitive operations cost 87.6× more than routine |
| **Gas Savings** | 49-69% | vs. all-ZK approach (70/30 workload) |
| **Privacy Budget (ε)** | 4.4733 | Measurable information leakage (pathway distinguishable) |
| **Mutual Information** | 1.0 bits | Perfect gas-pathway correlation |
| **Success Rate** | 100% | All operations across 1,000+ transactions |
| **Cohen's d** | 14,389 | Extremely significant statistical difference |

---

## 🏗️ Project Structure

```
hybrid-ehr-git_upload/
├── contracts/                      # Solidity smart contracts
│   ├── AllNonZKAccess.sol         # Pure RBAC baseline
│   ├── HybridEHRAccessV4.sol      # Hybrid selective ZK approach
│   ├── AllZKAccess.sol            # Universal ZK approach
│   └── ConsentVerifierV2.sol      # ZK proof verifier
│
├── circuits/                       # Zero-knowledge circuits
│   ├── consent-verification-v2.circom
│   ├── generate-valid-proof.js
│   ├── merkle-helper.js
│   ├── valid-proof.json           # Sample ZK proof
│   └── verification_key.json      # Verification key
│
├── scripts/                        # Deployment & benchmarking
│   ├── deploy-*.js                # Local deployment scripts
│   ├── benchmark-*.js             # Local benchmarking
│   ├── testnet/                   # Sepolia testnet scripts
│   │   ├── deploy-*-testnet.js
│   │   ├── benchmark-testnet-v4.js
│   │   └── testnet-privacy-benchmark.js
│   ├── classify-sensitivity.js    # HIPAA classification
│   └── parse-synthea-csv.js       # Patient data parsing
│
├── synthea-data/                   # Synthetic patient records
├── demo/                           # Interactive web demo
│   ├── hybrid-ehr-demo.html
│   ├── valid-proof.json
│   └── README.md
│
├── ipfs-mapping.json               # 16 registered patients
├── hardhat.config.js
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js v16+ and npm
- MetaMask wallet
- Alchemy API key (for testnet)
- ~0.5 ETH on Sepolia testnet (for deployment & testing)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/hybrid-ehr-git_upload.git
cd hybrid-ehr-git_upload

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

```bash
# Required for testnet deployment
ALCHEMY_API_KEY=your_alchemy_api_key_here
PRIVATE_KEY=your_wallet_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here (optional, for verification)
```

---

## 🔧 Setup Zero-Knowledge Circuits

### Generate Circuit Files

```bash
cd circuits

# Install circom (if not installed)
# Follow: https://docs.circom.io/getting-started/installation/

# Compile circuit
circom consent-verification-v2.circom --r1cs --wasm --sym

# Download powers of tau (14th degree, ~19MB)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau

# Generate proving key
snarkjs groth16 setup consent-verification-v2.r1cs powersOfTau28_hez_final_14.ptau circuit_0000.zkey

# Contribute to phase 2 ceremony
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="1st Contributor"

# Export verification key
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# Generate sample proof
node generate-valid-proof.js
```

**Output:** `valid-proof.json` (required for sensitive operations)

---

## 📦 Deployment

### Local Hardhat Network

```bash
# Terminal 1 - Start local blockchain
npx hardhat node

# Terminal 2 - Deploy contracts
npx hardhat run scripts/deploy-allnonzk.js --network localhost
npx hardhat run scripts/deploy-hybrid.js --network localhost
npx hardhat run scripts/deploy-allzk.js --network localhost

# Register sample patients
npx hardhat run scripts/classify-sensitivity.js --network localhost
```

### Sepolia Testnet

```bash
# Check balance first
node scripts/testnet/check-balance.js

# Deploy all contracts
node scripts/testnet/deploy-all-testnet.js

# Or deploy individually
node scripts/testnet/deploy-allnonzk-testnet.js
node scripts/testnet/deploy-hybrid-v4-testnet.js
node scripts/testnet/deploy-allzk-testnet.js
```

**Deployed Contracts (Sepolia):**
- **AllNonZK:** [`0x28472d124F9eBd34DfacD7b11eDe80E12fc337e1`](https://sepolia.etherscan.io/address/0x28472d124F9eBd34DfacD7b11eDe80E12fc337e1)
- **HybridV4:** [`0x620f15963721bEA41ceEA5688b5223b340F1B867`](https://sepolia.etherscan.io/address/0x620f15963721bEA41ceEA5688b5223b340F1B867)
- **AllZK:** [`0x75E5bBaF31E489E12D7Be680b4D985108f22a7C8`](https://sepolia.etherscan.io/address/0x75E5bBaF31E489E12D7Be680b4D985108f22a7C8)

---

## 📊 Benchmarking

### Local Performance Testing

```bash
# Benchmark individual models
node scripts/benchmark-allnonzk.js    # Pure RBAC
node scripts/benchmark-hybrid.js      # Hybrid approach
node scripts/benchmark-allzk.js       # Universal ZK

# Generate comparative statistics
node scripts/advanced-statistics.js
```

**Output:** `benchmark-*-results.json` files

### Testnet Benchmarking

```bash
# Comprehensive gas analysis (160 operations)
node scripts/testnet/benchmark-testnet-v4.js

# Privacy metrics analysis (480 operations, ~0.38 ETH)
node scripts/testnet/testnet-privacy-benchmark.js
```

**Output:** 
- `benchmark-testnet-v4-results.json` - Gas consumption data
- `testnet-privacy-report-[timestamp].json` - Privacy metrics

### Key Benchmark Results

| Model | Routine Gas | Sensitive Gas | Cost/10K ops (70/30) | Daily Capacity |
|-------|------------|---------------|---------------------|----------------|
| **AllNonZK** | 183,907 | - | $101M/year | 1,159K ops |
| **HybridV4** | 182,513 | 15,995,860 | $4.86B/year | 456K ops |
| **AllZK** | - | 16,022,612 | $15.95B/year | 133K ops |

*Assumptions: 50 gwei gas price, $3,000 ETH, 70% routine / 30% sensitive workload*

## Experimental Mapping

This section maps the experimental scripts in this repository to the tables and figures presented in the dissertation.

### Core Benchmarking Scripts

- **`scripts/benchmark-allnonzk.js`** - Generates baseline RBAC performance data
  - Contributes to: **Table 4.1** (AllNonZK rows), **Figure 4.1**, **Table 4.11**

- **`scripts/benchmark-hybrid.js`** - Measures hybrid model performance across routine and sensitive operations
  - Contributes to: **Table 4.1** (Hybrid rows), **Table 4.2**, **Figure 4.2**, **Table 4.8**, **Table 4.10**

- **`scripts/benchmark-allzk.js`** - Evaluates universal zero-knowledge model
  - Contributes to: **Table 4.1** (AllZK rows), **Figure 4.1**, **Table 4.7**, **Figure 4.4**

### Statistical Analysis

- **`scripts/advanced-statistics.js`** - Performs comprehensive statistical analysis on collected benchmark data
  - Generates: **Table 4.3** (CoV analysis), **Table 4.4** (success rates), **Table 4.7** (t-tests, Cohen's d), **Table 4.9** (privacy metrics)
  - Produces: **Figure 4.5** (privacy metrics visualization)
  - Generates: **Table 4.5**, **Figure 4.3**, **Table 4.8** (hospital scalability)


### Testnet Validation

- **`scripts/deploy-testnet.js`** + **`scripts/testnet-benchmark.js`** - Sepolia testnet deployment and validation
  - Generates: **Table 4.1** (Testnet columns), **Table 4.6** (environment comparison)
  - Validates: All testnet-specific metrics across **Tables 4.1-4.11**

---

## 🎨 Interactive Demo

A fully functional web-based demonstration that connects to deployed Sepolia contracts.

### Quick Start

```bash
cd demo
# Open hybrid-ehr-demo.html in Chrome/Firefox
# Ensure valid-proof.json is in same folder
```

### Features

- ✅ Real-time blockchain transactions (Sepolia testnet)
- ✅ 16 registered patients from `ipfs-mapping.json`
- ✅ MetaMask integration
- ✅ Live performance analytics
- ✅ Privacy metrics calculation (ε, MI, Cohen's d)
- ✅ Model comparison table
- ✅ Transaction history with Etherscan links

### Usage

1. **Connect MetaMask** to Sepolia testnet
2. **Select Patient** from dropdown (ROUTINE/SENSITIVE labeled)
3. **Choose Data Type:**
   - Green = Routine (RBAC) → AllNonZK contract
   - Yellow = Sensitive (ZK Proof) → HybridV4 contract
4. **Request Access** → Approve in MetaMask
5. **View Real-time Stats** updating with each transaction

See [demo/README.md](demo/README.md) for detailed setup.

---

## 🔬 Research Methodology

### Models Compared

1. **AllNonZK (Baseline):** Pure role-based access control, no cryptographic privacy
2. **HybridV4 (Proposed):** Sensitivity-based routing with selective ZK application
3. **AllZK (Maximum Privacy):** Universal zero-knowledge proofs for all operations

### Data Sources

- **Patients:** 16 synthetic records from Synthea (FHIR format)
- **Sensitivity Classification:** HIPAA Privacy Rule §164.501
- **Benchmarking:** 10 iterations × 16 patients × 3 models = 480 operations

### Statistical Analysis

- **Gas Consumption:** Mean, standard deviation, coefficient of variation
- **Privacy Metrics:** Mutual information, differential privacy (ε)
- **Effect Size:** Cohen's d (14,389.82 on testnet)
- **Significance:** p < 0.001 (z-score: 23,893.19)
- **Confidence Intervals:** 95% CI calculated for all metrics

---

## 📈 Key Research Contributions

### 1. Quantified Privacy-Performance Trade-off

First comprehensive measurement of information leakage (MI = 1.0, ε = 4.47) against cost savings (49-69%) in hybrid ZK systems.

### 2. Sensitivity-Based Routing Architecture

Novel approach applying cryptographic primitives based on data sensitivity rather than universal application.

### 3. Production Feasibility Validation

Demonstrated practical deployability on Ethereum testnet with 100% success rate across 1,000+ transactions.

### 4. Economic Impact Analysis

Projected annual cost savings of $11.09B (69.5%) for healthcare networks handling 10K daily transactions.

---

## 🛡️ Security Considerations

### Threat Model

- **Trusted:** Smart contract code, blockchain consensus, zero-knowledge circuit soundness
- **Untrusted:** External observers, potential node operators
- **Attack Vectors:** Gas pattern analysis, timing attacks, metadata correlation

### Privacy Limitations

⚠️ **Acknowledged Information Leakage:**
- Gas consumption patterns reveal operation type (routine vs. sensitive)
- Transaction timing and frequency observable on-chain
- Unified `requestAccess()` interface mitigates API-level pathway revelation
- Actual medical content remains cryptographically protected

### Mitigation Strategies

1. **Obfuscation:** Padding gas consumption to uniform levels
2. **Batching:** Aggregate operations to reduce granularity
3. **Off-chain Channels:** State channels for high-frequency access
4. **Differential Privacy:** Add calibrated noise to gas reporting

---

## 📚 Documentation

### Smart Contract Architecture

- `AllNonZKAccess.sol`: 6.1KB, 183K gas per operation
- `HybridEHRAccessV4.sol`: 8.8KB, 183K (routine) / 16M (sensitive) gas
- `AllZKAccess.sol`: 5.9KB, 16M gas per operation
- `ConsentVerifierV2.sol`: 7.2KB, ZK verifier with 7,281 constraints

### Circuit Specification

- **Inputs:** 6 (consentGiven, patientId, providerId, timestamp, purpose, recordHash)
- **Constraints:** 7,281
- **Proving Time:** ~2.3s (local), ~1.8s (optimized)
- **Verification Time:** ~0.02s on-chain

### API Reference

```solidity
// Unified access interface (both models)
function requestAccess(bytes32 patientId, bytes calldata proof) 
    external returns (bool)

// Patient registration
function registerPatient(
    bytes32 patientId, 
    string calldata ipfsHash, 
    bool isSensitive
) external onlyOwner

// Query functions
function getPatientIPFSHash(bytes32 patientId) 
    external view returns (string memory)
function isPatientRegistered(bytes32 patientId) 
    external view returns (bool)
```

---

## 🧪 Testing

```bash
# Run unit tests (if implemented)
npx hardhat test

# Gas reporting
REPORT_GAS=true npx hardhat test

# Coverage (if implemented)
npx hardhat coverage
```

---

## 📊 Results Summary

### Performance Metrics (Testnet)

| Metric | AllNonZK | HybridV4 | AllZK |
|--------|----------|----------|-------|
| Avg Gas (Routine) | 183,907 | 182,513 | - |
| Avg Gas (Sensitive) | - | 15,995,860 | 16,022,612 |
| Coefficient of Variation | 0.0000% | 0.0000% | 0.0012% |
| Success Rate | 100% | 100% | 100% |

### Privacy Metrics

| Metric | AllNonZK | HybridV4 | AllZK |
|--------|----------|----------|-------|
| Mutual Information | 0 bits | 1.0 bits | 0 bits |
| Privacy Budget (ε) | N/A | 4.4733 | 0.0000 |
| Pathway Distinguishability | None | Perfect | None |
| Content Privacy | None | Cryptographic | Cryptographic |

### Economic Analysis (70/30 workload, 10K daily ops)

| Model | Annual Cost | Savings vs AllZK |
|-------|-------------|------------------|
| AllNonZK | $101M | 99.4% |
| HybridV4 | $4.86B | 69.5% |
| AllZK | $15.95B | - |

---

## 🤝 Contributing

This is a dissertation research project. For questions or collaboration:

- **Author:** Kirthiga Ramachandran
- **Institution:** Atlantic Technological University, Letterkenny, Co.Donegal, Ireland
- **Program:** MSc in Blockchain Technology and Applications
- **Contact:** kirthifb1@gmail.com

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

---

## 📖 Citation

If you use this work in your research, please cite:

```bibtex
@mastersthesis{ramachandran2025hybrid,
  title={Optimizing Privacy-Preserving Healthcare Data Access: A Hybrid Zero-Knowledge and Conventional Cryptographic Approach for Electronic Health Records},
  author={Ramachandran, Kirthiga},
  year={2025},
  school={[Your University]},
  type={MSc Dissertation}
}
```

---

## 🔗 Related Resources

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Library](https://github.com/iden3/snarkjs)
- [Hardhat Documentation](https://hardhat.org/docs)
- [HIPAA Privacy Rule](https://www.hhs.gov/hipaa/for-professionals/privacy/index.html)
- [Ethereum Sepolia Testnet](https://sepolia.etherscan.io/)

---

## 📝 Changelog

### v1.0.0 (Current)
- ✅ Complete implementation of 3 models
- ✅ Testnet deployment on Sepolia
- ✅ Comprehensive benchmarking (1,000+ transactions)
- ✅ Privacy metrics analysis
- ✅ Interactive web demo
- ✅ Dissertation documentation

---

## ⚠️ Disclaimer

**This is academic research software. Not audited for production use.**

- Smart contracts have not undergone professional security audit
- Zero-knowledge circuits use test parameters (not production ceremony)
- Intended for research and educational purposes only
- Do not use with real patient data or in production environments

---

**Built with ❤️ for advancing privacy-preserving healthcare technology**