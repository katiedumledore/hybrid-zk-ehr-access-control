const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployAllNonZKTestnet() {
    console.log("🚀 Deploying All Non-ZK to Sepolia Testnet\n");
    console.log("=".repeat(70));
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name);
    console.log("Chain ID:", network.chainId);
    
    if (network.chainId !== 11155111n) {
        console.error("❌ ERROR: Not connected to Sepolia testnet!");
        console.error("   Run: npx hardhat run scripts/testnet/deploy-allnonzk-testnet.js --network sepolia");
        process.exit(1);
    }
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    console.log("\n📊 Deployer Account:");
    console.log("   Address:", deployer.address);
    console.log("   Balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.1")) {
        console.warn("\n⚠️  WARNING: Low balance! You may need more Sepolia ETH.");
        console.warn("   Get testnet ETH from: https://sepoliafaucet.com/");
    }
    
    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    console.log("\n⛽ Gas Price:", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");
    
    // 1. Deploy All Non-ZK Access Contract
    console.log("\n1️⃣  Deploying AllNonZKAccess...");
    const AllNonZK = await ethers.getContractFactory("AllNonZKAccess");
    
    console.log("   Estimating deployment gas...");
    const deploymentData = AllNonZK.getDeployTransaction();
    const estimatedGas = await ethers.provider.estimateGas({
        data: deploymentData.data,
        from: deployer.address
    });
    
    const estimatedCost = estimatedGas * (feeData.gasPrice || 0n);
    console.log("   Estimated gas:", estimatedGas.toString());
    console.log("   Estimated cost:", ethers.formatEther(estimatedCost), "ETH");
    
    console.log("   Deploying...");
    const allNonZK = await AllNonZK.deploy();
    await allNonZK.waitForDeployment();
    const allNonZKAddress = await allNonZK.getAddress();
    
    console.log("   ✓ Contract deployed:", allNonZKAddress);
    console.log("   ✓ View on Etherscan: https://sepolia.etherscan.io/address/" + allNonZKAddress);
    
    // 2. Grant provider role
    console.log("\n2️⃣  Setting up roles...");
    const roleTx = await allNonZK.grantProviderRole(deployer.address);
    await roleTx.wait();
    console.log("   ✓ Provider role granted");
    
    // 3. Load IPFS mapping (first 16 patients only)
    console.log("\n3️⃣  Loading patient data...");
    const mappingPath = path.join(__dirname, '../../ipfs-mapping.json');
    
    if (!fs.existsSync(mappingPath)) {
        console.error("   ❌ ipfs-mapping.json not found!");
        console.error("   Expected at:", mappingPath);
        process.exit(1);
    }
    
    const allPatients = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const mapping = allPatients.slice(0, 16); // Use first 16 (4-level tree capacity)
    
    console.log(`   ✓ Loaded ${mapping.length} patient records`);
    console.log(`   Distribution: ${mapping.filter(p => p.sensitivity === 'SENSITIVE').length} sensitive, ${mapping.filter(p => p.sensitivity === 'ROUTINE').length} routine`);
    
    // 4. Store patient records in smaller batches for testnet
    console.log("\n4️⃣  Storing patient records on-chain...");
    console.log("   Using smaller batches for testnet reliability");
    
    const BATCH_SIZE = 4; // Smaller batches for testnet
    let stored = 0;
    let totalGasUsed = 0n;
    
    for (let i = 0; i < mapping.length; i += BATCH_SIZE) {
        const batch = mapping.slice(i, i + BATCH_SIZE);
        
        const patientIds = batch.map(p => ethers.id(p.patientId));
        const ipfsCIDs = batch.map(p => p.ipfsCID);
        const sensitivities = batch.map(p => p.sensitivity === 'SENSITIVE' ? 1 : 0);
        const recordHashes = batch.map(p => p.recordHash);
        
        console.log(`   Batch ${Math.floor(i/BATCH_SIZE) + 1}: Storing patients ${i+1}-${Math.min(i+BATCH_SIZE, mapping.length)}...`);
        
        const tx = await allNonZK.batchStorePatientRecords(
            patientIds,
            ipfsCIDs,
            sensitivities,
            recordHashes
        );
        
        const receipt = await tx.wait();
        stored += batch.length;
        totalGasUsed += receipt.gasUsed;
        
        console.log(`      Gas used: ${receipt.gasUsed.toString()}`);
        process.stdout.write(`\r   Progress: ${stored}/${mapping.length} patients stored\n`);
    }
    
    console.log(`   ✓ All records stored! Total gas: ${totalGasUsed.toString()}`);
    
    // 5. Verify storage
    console.log("\n5️⃣  Verifying storage...");
    const totalPatients = await allNonZK.getTotalPatients();
    console.log(`   ✓ Total patients on-chain: ${totalPatients}`);
    
    const testPatientId = ethers.id(mapping[0].patientId);
    const recordInfo = await allNonZK.getPatientRecordInfo(testPatientId);
    console.log(`   ✓ Sample record verified: ${recordInfo[0].substring(0, 20)}...`);
    
    // 6. Save deployment info
    console.log("\n6️⃣  Saving deployment info...");
    const deploymentInfo = {
        network: "sepolia",
        chainId: Number(network.chainId),
        contract: allNonZKAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        patientsStored: Number(totalPatients),
        model: "All Non-ZK (Pure RBAC)",
        storageGasUsed: totalGasUsed.toString(),
        etherscanUrl: `https://sepolia.etherscan.io/address/${allNonZKAddress}`,
        description: "Baseline with NO zero-knowledge proofs - testnet deployment"
    };
    
    const outputPath = path.join(__dirname, '../../deployment-allnonzk-testnet.json');
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("   ✓ Saved to: deployment-allnonzk-testnet.json");
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ ALL NON-ZK TESTNET DEPLOYMENT COMPLETE");
    console.log("=".repeat(70));
    console.log(`\n📍 Contract: ${allNonZKAddress}`);
    console.log(`📊 Patients: ${totalPatients} records stored`);
    console.log(`⛽ Storage gas used: ${totalGasUsed.toString()}`);
    console.log(`🔗 Etherscan: https://sepolia.etherscan.io/address/${allNonZKAddress}`);
    console.log(`\n📋 Model: Pure RBAC (No ZK proofs)`);
    console.log(`   • Expected gas per access: ~45,000`);
    console.log(`\n🔬 Next: Run benchmark-allnonzk-testnet.js`);
    
    return deploymentInfo;
}

// Execute if run directly
if (require.main === module) {
    deployAllNonZKTestnet()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("\n❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = deployAllNonZKTestnet;
