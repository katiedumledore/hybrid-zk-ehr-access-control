const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployAllZKTestnet() {
    console.log("🚀 Deploying All-ZK System to Sepolia Testnet\n");
    console.log("=".repeat(70));
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name);
    console.log("Chain ID:", network.chainId);
    
    if (network.chainId !== 11155111n) {
        console.error("❌ ERROR: Not connected to Sepolia testnet!");
        console.error("   Run: npx hardhat run scripts/testnet/deploy-allzk-testnet.js --network sepolia");
        process.exit(1);
    }
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    console.log("\n📊 Deployer Account:");
    console.log("   Address:", deployer.address);
    console.log("   Balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.2")) {
        console.warn("\n⚠️  WARNING: Low balance! AllZK deployment requires more gas.");
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
    console.log("   Circuit: consent-verification-v2.circom");
    console.log("   Constraints: 7,281 (production-grade)");
    console.log("   Deploying...");
    
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    
    console.log("   ✓ Verifier deployed:", verifierAddress);
    console.log("   ✓ Etherscan:", `https://sepolia.etherscan.io/address/${verifierAddress}`);
    
    // 2. Deploy All-ZK Access Contract
    console.log("\n2️⃣  Deploying AllZKAccess...");
    const AllZK = await ethers.getContractFactory("AllZKAccess");
    
    console.log("   Estimating deployment gas...");
    const allzkDeployData = AllZK.getDeployTransaction(verifierAddress);
    const allzkGas = await ethers.provider.estimateGas({
        data: allzkDeployData.data,
        from: deployer.address
    });
    const allzkCost = allzkGas * (feeData.gasPrice || 0n);
    
    console.log("   Estimated gas:", allzkGas.toString());
    console.log("   Estimated cost:", ethers.formatEther(allzkCost), "ETH");
    console.log("   Deploying...");
    
    const allZK = await AllZK.deploy(verifierAddress);
    await allZK.waitForDeployment();
    const allZKAddress = await allZK.getAddress();
    
    console.log("   ✓ Contract deployed:", allZKAddress);
    console.log("   ✓ Etherscan:", `https://sepolia.etherscan.io/address/${allZKAddress}`);
    
    // 3. Load IPFS mapping (first 16 patients)
    console.log("\n3️⃣  Loading patient data...");
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
    console.log(`   Note: AllZK requires ZK proofs for ALL records`);
    
    // 4. Store patient records
    console.log("\n4️⃣  Storing patient records on-chain...");
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
        
        const tx = await allZK.batchStorePatientRecords(
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
    
    // 5. Verify storage
    console.log("\n5️⃣  Verifying storage...");
    const totalPatients = await allZK.getTotalPatients();
    console.log(`   ✓ Total patients on-chain: ${totalPatients}`);
    
    // 6. Save deployment info
    console.log("\n6️⃣  Saving deployment info...");
    const deploymentInfo = {
        network: "sepolia",
        chainId: Number(network.chainId),
        verifierAddress: verifierAddress,
        allZKAddress: allZKAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        patientsStored: Number(totalPatients),
        patientDistribution: {
            sensitive: sensitiveCount,
            routine: routineCount,
            total: mapping.length,
            note: "AllZK requires ZK proofs for ALL records"
        },
        model: "All-ZK (Universal ZKP)",
        circuitInfo: {
            constraints: 7281,
            file: "consent-verification-v2.circom",
            provingKey: "circuit_final.zkey",
            treeDepth: 4,
            maxPatients: 16
        },
        storageGasUsed: totalGasUsed.toString(),
        etherscanUrls: {
            verifier: `https://sepolia.etherscan.io/address/${verifierAddress}`,
            allZK: `https://sepolia.etherscan.io/address/${allZKAddress}`
        },
        description: "ALL access requires ZK proof verification (routine + sensitive) - testnet deployment"
    };
    
    const outputPath = path.join(__dirname, '../../deployment-allzk-testnet.json');
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("   ✓ Saved to: deployment-allzk-testnet.json");
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ ALL-ZK TESTNET DEPLOYMENT COMPLETE");
    console.log("=".repeat(70));
    console.log(`\n📍 Verifier: ${verifierAddress}`);
    console.log(`📍 Contract: ${allZKAddress}`);
    console.log(`📊 Patients: ${totalPatients} (${sensitiveCount} sensitive, ${routineCount} routine)`);
    console.log(`⛽ Storage gas: ${totalGasUsed.toString()}`);
    console.log(`\n🔗 View on Etherscan:`);
    console.log(`   Verifier: https://sepolia.etherscan.io/address/${verifierAddress}`);
    console.log(`   Contract: https://sepolia.etherscan.io/address/${allZKAddress}`);
    console.log(`\n📋 Model: Universal Zero-Knowledge Proofs`);
    console.log(`   • Routine records: ZK proof required (7,281 constraints)`);
    console.log(`   • Sensitive records: ZK proof required (7,281 constraints)`);
    console.log(`   • Expected gas per access: ~350k`);
    console.log(`\n🔬 Next: Run benchmark-allzk-testnet.js`);
    
    return deploymentInfo;
}

// Execute if run directly
if (require.main === module) {
    deployAllZKTestnet()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("\n❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = deployAllZKTestnet;
