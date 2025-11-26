const snarkjs = require("snarkjs");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { buildConsentTree, calculateNullifier } = require("./merkle-helper");

/**
 * Generate a VALID ZK proof with correct Merkle tree and nullifier
 */
async function generateValidProof() {
    console.log("\n🎯 GENERATING VALID ZK PROOF\n");
    console.log("=".repeat(70));
    
    // Load patient mapping
    const mappingPath = path.join(__dirname, '../ipfs-mapping.json');
    const allPatients = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    
    // Use only first 16 patients (4-level tree supports 16 leaves)
    const patients = allPatients.slice(0, 16);
    console.log(`📋 Using first ${patients.length} patients (4-level tree = 16 max)`);
    
    // Build Merkle tree
    const { tree, mimcsponge, consentSecrets, root } = await buildConsentTree(patients);
    
    // Select first patient for proof
    const patientIndex = 0;
    const patient = patients[patientIndex];
    const consentSecret = consentSecrets[patientIndex];
    
    console.log(`\n👤 Selected patient: ${patient.patientName}`);
    console.log(`   ID: ${patient.patientId.substring(0, 20)}...`);
    
    // Get Merkle proof
    const merkleProof = tree.getProof(patientIndex);
    
    console.log(`\n🔍 Merkle Proof:`);
    console.log(`   Path elements: ${merkleProof.pathElements.length}`);
    console.log(`   Path indices: [${merkleProof.pathIndices.join(', ')}]`);
    
    // Verify proof off-chain first
    const isValid = tree.verifyProof(
        merkleProof.leaf,
        merkleProof.pathElements,
        merkleProof.pathIndices,
        root
    );
    console.log(`   Verification: ${isValid ? '✓ VALID' : '✗ INVALID'}`);
    
    if (!isValid) {
        throw new Error("Merkle proof verification failed!");
    }
    
    // Calculate nullifier
    const nullifierHash = calculateNullifier(
        mimcsponge,
        consentSecret,
        patient.patientId
    );
    
    console.log(`\n🔐 Nullifier Hash: ${nullifierHash.substring(0, 20)}...`);
    
    // Convert patientId to field element
    const patientIdHash = ethers.toBigInt(ethers.id(patient.patientId));
    const patientIdField = patientIdHash % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    
    // Prepare circuit input
    const input = {
        merkleRoot: root,
        patientId: patientIdField.toString(),
        nullifierHash: nullifierHash,
        consentSecret: consentSecret,
        pathElements: merkleProof.pathElements,
        pathIndices: merkleProof.pathIndices
    };
    
    console.log(`\n📝 Circuit Input Prepared:`);
    console.log(`   Merkle Root: ${root.substring(0, 20)}...`);
    console.log(`   Patient ID (field): ${patientIdField.toString().substring(0, 20)}...`);
    console.log(`   Nullifier: ${nullifierHash.substring(0, 20)}...`);
    console.log(`   Consent Secret: ${consentSecret.substring(0, 20)}...`);
    
    // Generate ZK proof
    console.log(`\n⏳ Generating ZK proof (this takes 2-3 seconds)...`);
    
    const circuitWasm = path.join(__dirname, 'consent-verification-v2_js/consent-verification-v2.wasm');
    const provingKey = path.join(__dirname, 'circuit_final.zkey');
    
    const startTime = Date.now();
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        circuitWasm,
        provingKey
    );
    
    const provingTime = Date.now() - startTime;
    
    console.log(`✅ Proof generated in ${provingTime}ms`);
    console.log(`\n🎉 PUBLIC SIGNAL (isValid): ${publicSignals[0]}`);
    
    if (publicSignals[0] !== "1") {
        console.error("❌ ERROR: Proof is invalid (isValid = 0)");
        console.error("   This should not happen with correct inputs!");
        throw new Error("Generated invalid proof");
    }
    
    console.log(`   ✓ PROOF IS VALID! isValid = 1`);
    
    // Verify off-chain
    console.log(`\n🔍 Verifying proof off-chain...`);
    const vKey = JSON.parse(fs.readFileSync(path.join(__dirname, "verification_key.json")));
    
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    console.log(`   ${verified ? '✓' : '✗'} Off-chain verification: ${verified}`);
    
    // Export to Solidity format
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata
        .replace(/["[\]\s]/g, "")
        .split(",")
        .map((x) => BigInt(x).toString());
    
    const solidityProof = {
        proof_a: [argv[0], argv[1]],
        proof_b: [
            [argv[2], argv[3]],
            [argv[4], argv[5]]
        ],
        proof_c: [argv[6], argv[7]],
        publicSignals: [argv[8]]
    };
    
    // Save proof
    const proofData = {
        proof: proof,
        publicSignals: publicSignals,
        solidityProof: solidityProof,
        metadata: {
            patient: {
                id: patient.patientId,
                name: patient.patientName,
                index: patientIndex
            },
            merkleRoot: root,
            nullifierHash: nullifierHash,
            provingTime: provingTime,
            timestamp: new Date().toISOString(),
            circuitConstraints: 7281,
            treeDepth: 4,
            totalPatients: patients.length
        }
    };
    
    fs.writeFileSync(
        path.join(__dirname, "valid-proof.json"),
        JSON.stringify(proofData, null, 2)
    );
    
    console.log(`\n💾 Valid proof saved to: circuits/valid-proof.json`);
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ VALID PROOF GENERATION COMPLETE");
    console.log("=".repeat(70));
    console.log(`\n📊 Performance:`);
    console.log(`   Proving time: ${provingTime}ms`);
    console.log(`   Proof size: ${JSON.stringify(proof).length} bytes`);
    console.log(`   Public signal: ${publicSignals[0]} (isValid = 1 ✓)`);
    console.log(`\n🔐 Cryptographic Properties:`);
    console.log(`   ✓ Merkle tree membership verified`);
    console.log(`   ✓ Nullifier prevents replay attacks`);
    console.log(`   ✓ Zero-knowledge: consent secret hidden`);
    console.log(`   ✓ Tree depth: 4 levels (16 patients max)`);
    console.log(`\n🎯 Next: Use this proof for benchmark (200 iterations)`);
    
    return proofData;
}

// Run if called directly
if (require.main === module) {
    generateValidProof()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("❌ Error:", error);
            process.exit(1);
        });
}

module.exports = { generateValidProof };