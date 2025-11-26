const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployAllZK() {
    console.log("🚀 Deploying All-ZK Baseline System\n");
    console.log("=".repeat(70));
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying from:", deployer.address);
    
    // 1. Deploy ZK Verifier
    console.log("\n1️⃣  Deploying ConsentVerifierV2 (7,281 constraints)...");
    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("   ✓ ConsentVerifierV2:", verifierAddress);
    console.log("   ├─ Circuit: consent-verification-v2.circom");
    console.log("   └─ Constraints: 7,281 (production-grade)");
    
    // 2. Deploy All-ZK Access Contract
    console.log("\n2️⃣  Deploying AllZKAccess...");
    const AllZK = await ethers.getContractFactory("AllZKAccess");
    const allZK = await AllZK.deploy(verifierAddress);
    await allZK.waitForDeployment();
    const allZKAddress = await allZK.getAddress();
    console.log("   ✓ AllZKAccess:", allZKAddress);
    
    // 3. Load IPFS mapping
    console.log("\n3️⃣  Loading IPFS mapping...");
    const mappingPath = path.join(__dirname, '../ipfs-mapping.json');
    
    if (!fs.existsSync(mappingPath)) {
        console.error("   ✗ ipfs-mapping.json not found!");
        process.exit(1);
    }
    
    const allPatients = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    // Use first 16 patients (matching 4-level tree)
    const mapping = allPatients.slice(0, 16);
    console.log(`   ✓ Loaded ${mapping.length} patient records (4-level tree capacity)`);
    
    // 4. Store patient records (same as All Non-ZK)
    console.log("\n4️⃣  Storing patient records on-chain...");
    
    const BATCH_SIZE = 5;
    let stored = 0;
    
    for (let i = 0; i < mapping.length; i += BATCH_SIZE) {
        const batch = mapping.slice(i, i + BATCH_SIZE);
        
        const patientIds = batch.map(p => ethers.id(p.patientId));
        const ipfsCIDs = batch.map(p => p.ipfsCID);
        const sensitivities = batch.map(p => p.sensitivity === 'SENSITIVE' ? 1 : 0);
        const recordHashes = batch.map(p => p.recordHash);
        
        const tx = await allZK.batchStorePatientRecords(
            patientIds,
            ipfsCIDs,
            sensitivities,
            recordHashes
        );
        
        await tx.wait();
        stored += batch.length;
        
        process.stdout.write(`\r   Progress: ${stored}/${mapping.length} patients stored`);
    }
    
    console.log("\n   ✓ All patient records stored!");
    
    // 5. Verify storage
    console.log("\n5️⃣  Verifying storage...");
    const totalPatients = await allZK.getTotalPatients();
    console.log(`   ✓ Total patients on-chain: ${totalPatients}`);
    
    // 6. Save deployment info
    console.log("\n6️⃣  Saving deployment info...");
    const deploymentInfo = {
        network: "localhost",
        verifierAddress: verifierAddress,
        allZKAddress: allZKAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        patientsStored: Number(totalPatients),
        model: "All-ZK (Universal ZKP)",
        circuitInfo: {
            constraints: 7281,
            file: "consent-verification-v2.circom",
            provingKey: "circuit_final.zkey",
            treeDepth: 4,
            maxPatients: 16
        },
        description: "ALL access requires ZK proof verification (routine + sensitive)"
    };
    
    fs.writeFileSync(
        'deployment-allzk.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("   ✓ Saved to: deployment-allzk.json");
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ ALL-ZK DEPLOYMENT COMPLETE");
    console.log("=".repeat(70));
    console.log(`\nVerifier: ${verifierAddress}`);
    console.log(`Contract: ${allZKAddress}`);
    console.log(`Patients: ${totalPatients} records on-chain`);
    console.log(`\n📊 Model: Universal Zero-Knowledge Proofs`);
    console.log(`   • Routine records: ZK proof required (7,281 constraints)`);
    console.log(`   • Sensitive records: ZK proof required (7,281 constraints)`);
    console.log(`   • Expected gas: 300-400k per access`);
    console.log(`   • Expected proving time: ~2.6s per proof`);
    console.log(`\n🔬 Next: Run benchmark-allzk.js to collect performance data`);
}

deployAllZK().catch(error => {
    console.error(error);
    process.exit(1);
});