const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployHybridV4Testnet() {
    console.log("🚀 Deploying Hybrid V4 System to Sepolia Testnet\n");
    console.log("=".repeat(70));
    console.log("🔐 Privacy Enhancement: Unified access interface (V4)");
    console.log("   - Single requestAccess() function");
    console.log("   - No pathway type in events");
    console.log("   - Internal routing only");
    console.log("=".repeat(70));
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("\nNetwork:", network.name);
    console.log("Chain ID:", network.chainId);
    
    if (network.chainId !== 11155111n) {
        console.error("❌ ERROR: Not connected to Sepolia testnet!");
        console.error("   Run: npx hardhat run scripts/testnet/deploy-hybrid-v4-testnet.js --network sepolia");
        process.exit(1);
    }
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    console.log("\n📊 Deployer Account:");
    console.log("   Address:", deployer.address);
    console.log("   Balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.2")) {
        console.warn("\n⚠️  WARNING: Low balance! V4 deployment requires more gas.");
        console.warn("   Recommended: at least 0.2 ETH for safe deployment");
        console.warn("   Get testnet ETH from: https://sepoliafaucet.com/");
    }
    
    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    console.log("\n⛽ Gas Price:", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");
    
    // 1. Deploy ZK Verifier
    console.log("\n1️⃣  Deploying Groth16Verifier (7,281 constraints)...");
    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    
    console.log("   Estimating deployment gas...");
    const verifierDeployData = Verifier.getDeployTransaction();
    const verifierGas = await ethers.provider.estimateGas({
        data: verifierDeployData.data,
        from: deployer.address
    });
    const verifierCost = verifierGas * (feeData.gasPrice || 0n);
    
    console.log("   Estimated gas:", verifierGas.toString());
    console.log("   Estimated cost:", ethers.formatEther(verifierCost), "ETH");
    console.log("   Deploying...");
    
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    
    console.log("   ✓ Verifier deployed:", verifierAddress);
    console.log("   ✓ Etherscan:", `https://sepolia.etherscan.io/address/${verifierAddress}`);
    
    // 2. Deploy Hybrid V4 Access Contract
    console.log("\n2️⃣  Deploying HybridEHRAccessV4 (Privacy-Enhanced)...");
    const HybridV4 = await ethers.getContractFactory("HybridEHRAccessV4");
    
    console.log("   Estimating deployment gas...");
    const hybridDeployData = HybridV4.getDeployTransaction(verifierAddress);
    const hybridGas = await ethers.provider.estimateGas({
        data: hybridDeployData.data,
        from: deployer.address
    });
    const hybridCost = hybridGas * (feeData.gasPrice || 0n);
    
    console.log("   Estimated gas:", hybridGas.toString());
    console.log("   Estimated cost:", ethers.formatEther(hybridCost), "ETH");
    console.log("   Deploying...");
    
    const hybridV4 = await HybridV4.deploy(verifierAddress);
    await hybridV4.waitForDeployment();
    const hybridV4Address = await hybridV4.getAddress();
    
    console.log("   ✓ HybridV4 deployed:", hybridV4Address);
    console.log("   ✓ Etherscan:", `https://sepolia.etherscan.io/address/${hybridV4Address}`);
    
    // 3. Grant provider role
    console.log("\n3️⃣  Setting up roles...");
    const roleTx = await hybridV4.grantProviderRole(deployer.address);
    await roleTx.wait();
    console.log("   ✓ Provider role granted");
    
    // 4. Load IPFS mapping (first 16 patients)
    console.log("\n4️⃣  Loading patient data...");
    const mappingPath = path.join(__dirname, '../../ipfs-mapping.json');
    
    if (!fs.existsSync(mappingPath)) {
        console.error("   ❌ ipfs-mapping.json not found!");
        process.exit(1);
    }
    
    const allPatients = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const mapping = allPatients.slice(0, 16);
    
    const sensitiveCount = mapping.filter(p => p.sensitivity === 'SENSITIVE').length;
    const routineCount = mapping.filter(p => p.sensitivity === 'ROUTINE').length;
    
    console.log(`   ✓ Loaded ${mapping.length} patient records`);
    console.log(`   Distribution: ${sensitiveCount} sensitive, ${routineCount} routine`);
    
    // 5. Store patient records
    console.log("\n5️⃣  Storing patient records on-chain...");
    console.log("   Using smaller batches for testnet reliability");
    
    const BATCH_SIZE = 4;
    let stored = 0;
    let totalGasUsed = 0n;
    
    for (let i = 0; i < mapping.length; i += BATCH_SIZE) {
        const batch = mapping.slice(i, i + BATCH_SIZE);
        
        const patientIds = batch.map(p => ethers.id(p.patientId));
        const ipfsCIDs = batch.map(p => p.ipfsCID);
        const sensitivities = batch.map(p => p.sensitivity === 'SENSITIVE' ? 1 : 0);
        const recordHashes = batch.map(p => p.recordHash);
        
        console.log(`   Batch ${Math.floor(i/BATCH_SIZE) + 1}: Storing patients ${i+1}-${Math.min(i+BATCH_SIZE, mapping.length)}...`);
        
        const tx = await hybridV4.batchStorePatientRecords(
            patientIds,
            ipfsCIDs,
            sensitivities,
            recordHashes
        );
        
        const receipt = await tx.wait();
        stored += batch.length;
        totalGasUsed += receipt.gasUsed;
        
        console.log(`      Gas used: ${receipt.gasUsed.toString()}`);
    }
    
    console.log(`   ✓ All records stored! Total gas: ${totalGasUsed.toString()}`);
    
    // 6. Verify storage
    console.log("\n6️⃣  Verifying storage...");
    const totalPatients = await hybridV4.getTotalPatients();
    console.log(`   ✓ Total patients on-chain: ${totalPatients}`);
    
    // 7. Save deployment info
    console.log("\n7️⃣  Saving deployment info...");
    const deploymentInfo = {
        network: "sepolia",
        chainId: Number(network.chainId),
        verifierAddress: verifierAddress,
        hybridV4Address: hybridV4Address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        patientsStored: Number(totalPatients),
        patientDistribution: {
            sensitive: sensitiveCount,
            routine: routineCount,
            total: mapping.length
        },
        model: "Hybrid V4 (Privacy-Enhanced)",
        version: "V4",
        privacyFeatures: [
            "Unified requestAccess() interface",
            "No pathway type in events",
            "Internal routing only",
            "Encoded proof format",
            "Reduced metadata leakage"
        ],
        circuitInfo: {
            constraints: 7281,
            file: "consent-verification-v2.circom",
            treeDepth: 4,
            maxPatients: 16
        },
        storageGasUsed: totalGasUsed.toString(),
        etherscanUrls: {
            verifier: `https://sepolia.etherscan.io/address/${verifierAddress}`,
            hybridV4: `https://sepolia.etherscan.io/address/${hybridV4Address}`
        },
        description: "V4: Unified interface - Sensitive → ZK proof, Routine → RBAC (internal routing) - testnet deployment"
    };
    
    const outputPath = path.join(__dirname, '../../deployment-hybrid-v4-testnet.json');
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("   ✓ Saved to: deployment-hybrid-v4-testnet.json");
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ HYBRID V4 TESTNET DEPLOYMENT COMPLETE");
    console.log("=".repeat(70));
    console.log(`\n📍 Verifier: ${verifierAddress}`);
    console.log(`📍 HybridV4: ${hybridV4Address}`);
    console.log(`📊 Patients: ${totalPatients} (${sensitiveCount} sensitive, ${routineCount} routine)`);
    console.log(`⛽ Storage gas: ${totalGasUsed.toString()}`);
    console.log(`\n🔗 View on Etherscan:`);
    console.log(`   Verifier: https://sepolia.etherscan.io/address/${verifierAddress}`);
    console.log(`   HybridV4: https://sepolia.etherscan.io/address/${hybridV4Address}`);
    console.log(`\n🔐 V4 Privacy Features:`);
    console.log(`   ✓ Unified access interface`);
    console.log(`   ✓ No pathway type in events`);
    console.log(`   ✓ Internal routing (not visible externally)`);
    console.log(`   ✓ Only gas differential remains (acknowledged trade-off)`);
    console.log(`\n📋 Model: Hybrid Smart Routing V4`);
    console.log(`   • Routine records: RBAC only (~45k gas)`);
    console.log(`   • Sensitive records: ZK proof required (~350k gas)`);
    console.log(`   • Same function for both types: requestAccess(patientId, zkProof)`);
    console.log(`\n🔬 Next: Run benchmark-testnet-v4.js`);
    
    return deploymentInfo;
}

// Execute if run directly
if (require.main === module) {
    deployHybridV4Testnet()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("\n❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = deployHybridV4Testnet;