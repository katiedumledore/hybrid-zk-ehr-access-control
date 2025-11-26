const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployHybrid() {
    console.log("🚀 Deploying Hybrid System\n");
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
    
    // 2. Deploy Hybrid Access Contract
    console.log("\n2️⃣  Deploying HybridEHRAccessV3...");
    const Hybrid = await ethers.getContractFactory("HybridEHRAccessV3");
    const hybrid = await Hybrid.deploy(verifierAddress);
    await hybrid.waitForDeployment();
    const hybridAddress = await hybrid.getAddress();
    console.log("   ✓ HybridEHRAccessV3:", hybridAddress);
    
    // 3. Grant provider role
    console.log("\n3️⃣  Setting up roles...");
    await hybrid.grantProviderRole(deployer.address);
    console.log("   ✓ Provider role granted to deployer");
    
    // 4. Load IPFS mapping
    console.log("\n4️⃣  Loading IPFS mapping...");
    const mappingPath = path.join(__dirname, '../ipfs-mapping.json');
    
    if (!fs.existsSync(mappingPath)) {
        console.error("   ✗ ipfs-mapping.json not found!");
        process.exit(1);
    }
    
    const allPatients = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    // Use first 16 patients (matching 4-level tree)
    const mapping = allPatients.slice(0, 16);
    console.log(`   ✓ Loaded ${mapping.length} patient records (4-level tree capacity)`);
    
    // 5. Store patient records
    console.log("\n5️⃣  Storing patient records on-chain...");
    
    const BATCH_SIZE = 5;
    let stored = 0;
    
    for (let i = 0; i < mapping.length; i += BATCH_SIZE) {
        const batch = mapping.slice(i, i + BATCH_SIZE);
        
        const patientIds = batch.map(p => ethers.id(p.patientId));
        const ipfsCIDs = batch.map(p => p.ipfsCID);
        const sensitivities = batch.map(p => p.sensitivity === 'SENSITIVE' ? 1 : 0);
        const recordHashes = batch.map(p => p.recordHash);
        
        const tx = await hybrid.batchStorePatientRecords(
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
    
    // 6. Verify storage
    console.log("\n6️⃣  Verifying storage...");
    const totalPatients = await hybrid.getTotalPatients();
    console.log(`   ✓ Total patients on-chain: ${totalPatients}`);
    
    // 7. Save deployment info
    console.log("\n7️⃣  Saving deployment info...");
    const deploymentInfo = {
        network: "localhost",
        verifierAddress: verifierAddress,
        hybridAddress: hybridAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        patientsStored: Number(totalPatients),
        model: "Hybrid (ZK for sensitive + RBAC for routine)",
        circuitInfo: {
            constraints: 7281,
            file: "consent-verification-v2.circom",
            treeDepth: 4,
            maxPatients: 16
        },
        description: "Sensitive → ZK proof, Routine → RBAC"
    };
    
    fs.writeFileSync(
        'deployment-hybrid.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("   ✓ Saved to: deployment-hybrid.json");
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ HYBRID DEPLOYMENT COMPLETE");
    console.log("=".repeat(70));
    console.log(`\nVerifier: ${verifierAddress}`);
    console.log(`Contract: ${hybridAddress}`);
    console.log(`Patients: ${totalPatients} records on-chain`);
    console.log(`\n📊 Model: Hybrid Smart Routing`);
    console.log(`   • Routine records: RBAC only (~45k gas)`);
    console.log(`   • Sensitive records: ZK proof required (~29M gas)`);
    console.log(`   • Smart routing based on sensitivity`);
    console.log(`\n🔬 Next: Run benchmark-hybrid.js to collect performance data`);
}

deployHybrid().catch(error => {
    console.error(error);
    process.exit(1);
});