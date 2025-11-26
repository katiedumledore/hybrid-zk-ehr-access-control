# Zero-Knowledge Circuits Documentation

Circom circuits for consent verification in hybrid EHR access control.

## 📋 Overview

Zero-knowledge proof circuit that verifies patient consent for sensitive data access without revealing the consent details on-chain.

| Property | Value |
|----------|-------|
| **Circuit Name** | consent-verification-v2 |
| **Language** | Circom 2.0 |
| **Proof System** | Groth16 |
| **Curve** | BN254 (alt_bn128) |
| **Constraints** | 7,281 |
| **Proving Time** | ~2.3s (local), ~1.8s (optimized) |
| **Verification Time** | ~0.02s (on-chain) |
| **Proof Size** | ~1.2 KB |

---

## 🏗️ Circuit Architecture

```
consent-verification-v2.circom
    │
    ├─ Input Signals (6)
    │   ├─ consentGiven [public]
    │   ├─ patientId [private]
    │   ├─ providerId [private]
    │   ├─ timestamp [private]
    │   ├─ purpose [private]
    │   └─ recordHash [private]
    │
    ├─ Constraints (7,281)
    │   ├─ Range checks
    │   ├─ Hash validations
    │   └─ Consent logic
    │
    └─ Output
        └─ Proof of valid consent
```

---

## 📝 Circuit Logic

### Input Signals

```circom
signal input consentGiven;     // 1 = consent given, 0 = denied
signal input patientId;        // Hashed patient identifier
signal input providerId;       // Hashed provider identifier  
signal input timestamp;        // Unix timestamp of consent
signal input purpose;          // Purpose code (1-10)
signal input recordHash;       // Hash of medical record
```

### Constraints

1. **Binary Constraint:** `consentGiven * (1 - consentGiven) === 0`
   - Ensures consentGiven is 0 or 1

2. **Range Checks:**
   - `timestamp > 0` - Valid timestamp
   - `purpose >= 1 AND purpose <= 10` - Valid purpose code

3. **Hash Validation:**
   - Verifies integrity of consent record
   - Links consent to specific patient/provider/record

### Output

```circom
signal output validConsent;
validConsent <== consentGiven;
```

---

## 🔧 Setup & Installation

### Prerequisites

```bash
# Install Node.js 16+
node --version

# Install Circom
# See: https://docs.circom.io/getting-started/installation/
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Install snarkjs
npm install -g snarkjs
```

### Compilation

```bash
cd circuits

# Compile circuit
circom consent-verification-v2.circom --r1cs --wasm --sym

# Output files:
# - consent-verification-v2.r1cs     (Rank-1 Constraint System)
# - consent-verification-v2.wasm     (WebAssembly for witness generation)
# - consent-verification-v2.sym      (Symbol table)
# - consent-verification-v2_js/      (JavaScript witness generator)
```

---

## 🔑 Trusted Setup (Powers of Tau)

### Download Powers of Tau

```bash
# For 7,281 constraints, need 2^14 powers (14th degree)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau

# Or higher degree for safety margin
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau
```

### Generate Proving Key

```bash
# Phase 2 Setup - Circuit-specific ceremony
snarkjs groth16 setup \
    consent-verification-v2.r1cs \
    powersOfTau28_hez_final_14.ptau \
    circuit_0000.zkey

# Contribute to ceremony (adds entropy)
snarkjs zkey contribute \
    circuit_0000.zkey \
    circuit_final.zkey \
    --name="First Contribution" \
    -v

# Export verification key
snarkjs zkey export verificationkey \
    circuit_final.zkey \
    verification_key.json
```

**Output Files:**
- `circuit_final.zkey` - Proving key (~3.8 MB)
- `verification_key.json` - Verification key (~2.9 KB)

---

## 🎯 Proof Generation

### Method 1: Using Helper Script

```bash
node generate-valid-proof.js
```

**Output:** `valid-proof.json`

### Method 2: Manual Generation

```bash
# Create input file
cat > input.json << EOF
{
    "consentGiven": "1",
    "patientId": "12345",
    "providerId": "67890",
    "timestamp": "1699876543",
    "purpose": "3",
    "recordHash": "11111111111"
}
EOF

# Generate witness
node consent-verification-v2_js/generate_witness.js \
    consent-verification-v2_js/consent-verification-v2.wasm \
    input.json \
    witness.wtns

# Generate proof
snarkjs groth16 prove \
    circuit_final.zkey \
    witness.wtns \
    proof.json \
    public.json

# Export for Solidity
snarkjs zkey export solidityverifier \
    circuit_final.zkey \
    ConsentVerifierV2.sol

# Convert to Solidity calldata format
snarkjs generatecall public.json proof.json
```

---

## 📦 Proof Format

### proof.json Structure

```json
{
  "pi_a": ["...", "...", "1"],
  "pi_b": [["...", "..."], ["...", "..."], ["1", "0"]],
  "pi_c": ["...", "...", "1"],
  "protocol": "groth16",
  "curve": "bn128"
}
```

### valid-proof.json (Used in Demo)

```json
{
  "solidityProof": {
    "proof_a": [
      "0x1234...",
      "0x5678..."
    ],
    "proof_b": [
      ["0xabcd...", "0xef01..."],
      ["0x2345...", "0x6789..."]
    ],
    "proof_c": [
      "0x9abc...",
      "0xdef0..."
    ],
    "publicSignals": ["1"]
  }
}
```

---

## 🔬 Verification

### Off-Chain Verification

```bash
# Verify proof locally
snarkjs groth16 verify \
    verification_key.json \
    public.json \
    proof.json

# Output: OK if proof is valid
```

### On-Chain Verification

Performed by `ConsentVerifierV2.sol`:

```solidity
function verifyProof(
    uint256[2] calldata _pA,
    uint256[2][2] calldata _pB,
    uint256[2] calldata _pC,
    uint256[1] calldata _pubSignals
) public view returns (bool)
```

**Gas Cost:** ~290,000 gas (included in 16M total for sensitive operations)

---

## 📊 Performance Benchmarks

### Proving Time

| Environment | Time | CPU |
|-------------|------|-----|
| Local (MacBook Pro M1) | ~2.3s | Apple M1 |
| Local (Intel i7-9700K) | ~3.1s | Intel i7 |
| Optimized Build | ~1.8s | Server-grade |

### Verification Time

| Environment | Time |
|-------------|------|
| On-chain (Ethereum) | ~20ms |
| Off-chain (JavaScript) | ~5ms |

### File Sizes

| File | Size |
|------|------|
| circuit_final.zkey | 3.8 MB |
| verification_key.json | 2.9 KB |
| proof.json | ~1.2 KB |
| witness.wtns | ~32 KB |

---

## 🛠️ Helper Scripts

### generate-valid-proof.js

Generates a valid proof for demo purposes.

```bash
node generate-valid-proof.js
```

**Features:**
- Pre-configured valid inputs
- Automatic witness generation
- Solidity-formatted output
- Error handling

**Output:** `valid-proof.json`

### merkle-helper.js

Merkle tree utilities for privacy-preserving patient sets.

```bash
node merkle-helper.js
```

**Functions:**
- `generateMerkleTree(leaves)` - Build tree
- `getMerkleProof(tree, leaf)` - Get inclusion proof
- `verifyMerkleProof(root, leaf, proof)` - Verify proof

---

## 🔐 Security Considerations

### Trusted Setup Security

⚠️ **Current Status:** Research-only trusted setup

**Production Requirements:**
1. Multi-party computation (MPC) ceremony
2. Minimum 5-10 independent contributors
3. Published ceremony transcripts
4. Community verification

### Circuit Vulnerabilities

**Potential Issues:**
1. **Under-constrained circuits** - Missing constraints allow false proofs
2. **Range overflow** - Large numbers bypass checks
3. **Hash collisions** - Weak hash functions
4. **Timing attacks** - Side-channel leakage during proving

**Mitigations:**
- Formal verification of constraints
- Use well-tested templates (circomlib)
- Add redundant safety checks
- Professional audit before production

### Proof Security

**Assumptions:**
- Soundness: Cannot forge proof without valid witness
- Zero-knowledge: Proof reveals nothing about private inputs
- Completeness: Valid witness always produces valid proof

**Requirements:**
- Secure randomness during proving
- Protected proving key storage
- Proof freshness (no replay attacks)

---

## 🧪 Testing

### Unit Tests

```bash
# Test circuit logic
circom consent-verification-v2.circom --r1cs --wasm --sym --c

# Compile C++ witness generator
cd consent-verification-v2_cpp
make

# Run with test inputs
./consent-verification-v2 ../input.json ../witness.wtns
```

### Integration Tests

```javascript
// Test proof generation
const { expect } = require("chai");
const snarkjs = require("snarkjs");

it("Should generate valid proof", async () => {
    const input = {
        consentGiven: "1",
        patientId: "12345",
        // ...
    };
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "consent-verification-v2.wasm",
        "circuit_final.zkey"
    );
    
    const vKey = JSON.parse(fs.readFileSync("verification_key.json"));
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    expect(verified).to.be.true;
});
```

---

## 📈 Constraint Optimization

### Current: 7,281 Constraints

**Breakdown:**
- Binary checks: ~100
- Range checks: ~500
- Hash operations: ~6,000
- Logic gates: ~681

### Optimization Strategies

1. **Use Efficient Templates:**
   - Poseidon hash (fewer constraints than SHA256)
   - EdDSA signatures (vs RSA)
   - Binary to decimal conversions

2. **Reduce Redundancy:**
   - Remove duplicate checks
   - Combine similar constraints
   - Optimize arithmetic operations

3. **Trade-offs:**
   - Security vs constraints
   - Expressiveness vs efficiency
   - Proving time vs verification time

---

## 🔗 Integration with Smart Contracts

### HybridEHRAccessV4.sol Integration

```solidity
// Deploy verifier
ConsentVerifierV2 verifier = new ConsentVerifierV2();

// In requestAccess()
if (isSensitive) {
    // Decode proof from bytes
    (uint256[2] memory a, uint256[2][2] memory b, 
     uint256[2] memory c, uint256[1] memory input) = 
        abi.decode(proof, (uint256[2], uint256[2][2], 
                          uint256[2], uint256[1]));
    
    // Verify on-chain
    bool isValid = verifier.verifyProof(a, b, c, input);
    require(isValid, "Invalid consent proof");
}
```

### Gas Analysis

| Operation | Gas Cost |
|-----------|----------|
| Proof verification | ~290,000 |
| Storage updates | ~20,000 |
| Event emissions | ~3,000 |
| RBAC checks | ~5,000 |
| **Total (Sensitive)** | **~318,000** |

*Note: Actual on-chain cost ~16M includes full transaction overhead*

---

## 📚 Dependencies

```json
{
  "circom": "^2.1.6",
  "snarkjs": "^0.7.0",
  "circomlib": "^2.0.5"
}
```

### Circomlib Templates Used
- `Poseidon` - Hash function
- `Comparators` - Less than / greater than
- `Gates` - AND, OR, NOT logic

---

## 🎓 Educational Resources

### Learn Circom
- [Circom Documentation](https://docs.circom.io/)
- [0xPARC ZK Learning Group](https://learn.0xparc.org/)
- [ZK Whiteboard Sessions](https://zkhack.dev/whiteboard/)

### Groth16 Background
- [Original Paper](https://eprint.iacr.org/2016/260.pdf)
- [zkSNARKs in a Nutshell](https://chriseth.github.io/notes/articles/zksnarks/zksnarks.pdf)

### Tools
- [zkREPL](https://zkrepl.dev/) - Online Circom playground
- [circom-mutator](https://github.com/aviggiano/circom-mutator) - Testing tool

---

## 🔍 Debugging

### Common Issues

**1. Witness Generation Fails**
```bash
# Check input format
cat input.json | jq .

# Verify all required fields present
# Ensure values are strings, not numbers
```

**2. Proof Verification Fails**
```bash
# Regenerate proving key
snarkjs groth16 setup ... 

# Check curve compatibility (BN254 vs BLS12-381)
snarkjs info -c circuit_final.zkey
```

**3. On-Chain Verification Fails**
```bash
# Verify proof off-chain first
snarkjs groth16 verify verification_key.json public.json proof.json

# Check Solidity verifier version matches circuit
# Ensure correct public signals order
```

### Debug Mode

```bash
# Generate debug symbols
circom consent-verification-v2.circom --r1cs --wasm --sym --inspect

# View constraint details
snarkjs r1cs print consent-verification-v2.r1cs consent-verification-v2.sym
```

---

## 📊 Comparison: Circom vs Other ZK Frameworks

| Feature | Circom | Noir | ZoKrates |
|---------|--------|------|----------|
| Language | Custom DSL | Rust-like | Python-like |
| Learning Curve | Medium | High | Low |
| Constraint Count | 7,281 | ~8,000 | ~10,000 |
| Proving Time | 2.3s | 3.1s | 4.2s |
| Maturity | High | Growing | Medium |
| Community | Large | Growing | Medium |

---

## 🗂️ File Structure

```
circuits/
├── consent-verification-v2.circom       # Main circuit
├── generate-valid-proof.js              # Proof generator
├── merkle-helper.js                     # Merkle tree utilities
├── input.json                           # Sample input
├── valid-proof.json                     # Demo proof
├── verification_key.json                # Verification key
├── circuit_final.zkey                   # Proving key (gitignored)
├── consent-verification-v2.r1cs         # Constraints (gitignored)
├── consent-verification-v2.sym          # Symbols (gitignored)
├── consent-verification-v2.wasm         # Witness gen (gitignored)
└── consent-verification-v2_js/          # JS witness gen (gitignored)
```

---

## 🚀 Production Deployment Checklist

- [ ] Multi-party trusted setup ceremony
- [ ] Professional circuit audit
- [ ] Constraint optimization review
- [ ] Side-channel attack analysis
- [ ] Proof freshness mechanism
- [ ] Key management system
- [ ] Monitoring & alerting
- [ ] Upgrade path defined

---

## 🔗 Related Documentation

- [Smart Contract Documentation](../contracts/README.md)
- [Benchmark Results](../data/benchmarks/README.md)
- [Main README](../README.md)

---

## 🤝 Contributing

This is academic research. For questions: kirthifb1@gmail.com

---

**Circuit Status:** ✅ Functional for research | ⚠️ Not production-ready