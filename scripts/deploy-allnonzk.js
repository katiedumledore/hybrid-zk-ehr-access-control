const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployAllNonZK() {
    console.log("🚀 Deploying All Non-ZK Baseline System\n");
    console.log("=".repeat(60));
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying from:", deployer.address);
    
    // 1. Deploy All Non-ZK Access Contract
    console.log("\n1️⃣ Deploying AllNonZKAccess...");
    const AllNonZK = await ethers.getContractFactory("AllNonZKAccess");
    const allNonZK = await AllNonZK.deploy();
    await allNonZK.waitForDeployment();
    const allNonZKAddress = await allNonZK.getAddress();
    console.log("   ✓ AllNonZKAccess:", allNonZKAddress);
    
    // 2. Grant provider role
    console.log("\n2️⃣ Setting up roles...");
    await allNonZK.grantProviderRole(deployer.address);
    console.log("   ✓ Provider role granted to deployer");
    
    // 3. Load IPFS mapping
    console.log("\n3️⃣ Loading IPFS mapping...");
    const mappingPath = path.join(__dirname, '../ipfs-mapping.json');
    
    if (!fs.existsSync(mappingPath)) {
        console.error("   ✗ ipfs-mapping.json not found!");
        console.error("   Run Phase 1 scripts first");
        process.exit(1);
    }
    
    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    console.log(`   ✓ Loaded ${mapping.length} patient records`);
    
    // 4. Store patient records on-chain (in batches)
    console.log("\n4️⃣ Storing patient records on-chain...");
    console.log("   (Only IPFS CIDs, not actual medical data)");
    
    const BATCH_SIZE = 5;
    let stored = 0;
    
    for (let i = 0; i < mapping.length; i += BATCH_SIZE) {
        const batch = mapping.slice(i, i + BATCH_SIZE);
        
        const patientIds = batch.map(p => ethers.id(p.patientId));
        const ipfsCIDs = batch.map(p => p.ipfsCID);
        const sensitivities = batch.map(p => p.sensitivity === 'SENSITIVE' ? 1 : 0);
        const recordHashes = batch.map(p => p.recordHash);
        
        const tx = await allNonZK.batchStorePatientRecords(
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
    console.log("\n5️⃣ Verifying storage...");
    const totalPatients = await allNonZK.getTotalPatients();
    console.log(`   ✓ Total patients on-chain: ${totalPatients}`);
    
    // Test retrieval
    const testPatientId = ethers.id(mapping[0].patientId);
    const recordInfo = await allNonZK.getPatientRecordInfo(testPatientId);
    console.log(`   ✓ Sample record CID: ${recordInfo[0].substring(0, 20)}...`);
    
    // 6. Save deployment info
    console.log("\n6️⃣ Saving deployment info...");
    const deploymentInfo = {
        network: "localhost",
        allNonZKAddress: allNonZKAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        patientsStored: Number(totalPatients),
        model: "All Non-ZK (Pure RBAC)",
        description: "Baseline with NO zero-knowledge proofs"
    };
    
    fs.writeFileSync(
        'deployment-allnonzk.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("   ✓ Saved to: deployment-allnonzk.json");
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL NON-ZK DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log(`\nContract: ${allNonZKAddress}`);
    console.log(`Patients: ${totalPatients} records on-chain`);
    console.log(`\n📊 Model: Pure RBAC (No ZK proofs at all)`);
    console.log(`   • Routine records: RBAC only`);
    console.log(`   • Sensitive records: RBAC only (⚠️ no ZK protection)`);
    console.log(`\n🔬 Next: Run benchmark-allnonzk.js to collect metrics`);
}

deployAllNonZK().catch(error => {
    console.error(error);
    process.exit(1);
});