const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Testnet Benchmarking Script for V4
 * Tests all 3 models with correct interfaces:
 * - AllNonZK: requestAccess(bytes32)
 * - HybridV4: requestAccess(bytes32, bytes) - unified interface
 * - AllZK: requestAccess(bytes32, uint[2], uint[2][2], uint[2], uint[1])
 */

async function benchmarkTestnetV4(iterations = 10) {
    console.log("🔬 Testnet Benchmarking - All Models (V4 Compatible)\n");
    console.log("=".repeat(70));
    console.log(`Iterations per model: ${iterations}`);
    console.log(`Hybrid model: V4 (unified interface)`);
    console.log("=".repeat(70));
    
    // Verify network
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 11155111n) {
        console.error("❌ ERROR: Not connected to Sepolia testnet!");
        process.exit(1);
    }
    
    const [signer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(signer.address);
    
    console.log("\n📊 Account Info:");
    console.log("   Address:", signer.address);
    console.log("   Balance:", ethers.formatEther(balance), "ETH");
    
    // Get gas price
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    console.log("   Gas Price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
    
    // Load deployment info
    console.log("\n📂 Loading deployment info...");
    const deployments = loadDeployments();
    
    if (!deployments.allNonZK || !deployments.hybridV4 || !deployments.allZK) {
        console.error("❌ Missing deployment files!");
        console.error("   Required files:");
        console.error("   - deployment-allnonzk-testnet.json");
        console.error("   - deployment-hybrid-v4-testnet.json");
        console.error("   - deployment-allzk-testnet.json");
        process.exit(1);
    }
    
    console.log("   ✓ AllNonZK:", deployments.allNonZK.contract);
    console.log("   ✓ HybridV4:", deployments.hybridV4.hybridV4Address);
    console.log("   ✓ AllZK:", deployments.allZK.allZKAddress);
    
    // Load IPFS mapping
    const mappingPath = path.join(__dirname, '../../ipfs-mapping.json');
    const allPatients = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const patients = allPatients.slice(0, 16);
    
    console.log(`\n👥 Patient Data: ${patients.length} records`);
    console.log(`   Sensitive: ${patients.filter(p => p.sensitivity === 'SENSITIVE').length}`);
    console.log(`   Routine: ${patients.filter(p => p.sensitivity === 'ROUTINE').length}`);
    
    // Load ZK proof
    console.log("\n🔐 Loading ZK proof...");
    const proofPath = path.join(__dirname, '../../valid-proof.json');
    const proofData = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    
    // Prepare both proof formats
    const zkProofEncoded = encodeProof(proofData.solidityProof); // For HybridV4
    const zkProofComponents = proofData.solidityProof; // For AllZK
    
    console.log("   ✓ ZK proof loaded (both formats prepared)");
    
    // Initialize results storage
    const results = {
        network: "sepolia",
        chainId: Number(network.chainId),
        timestamp: new Date().toISOString(),
        iterations,
        gasPrice: gasPrice.toString(),
        gasPriceGwei: ethers.formatUnits(gasPrice, "gwei"),
        hybridVersion: "V4",
        models: {}
    };
    
    // Benchmark each model
    console.log("\n" + "=".repeat(70));
    console.log("BENCHMARKING START");
    console.log("=".repeat(70));
    
    // 1. AllNonZK
    console.log("\n\n📊 Model 1/3: AllNonZK (Pure RBAC)");
    console.log("─".repeat(70));
    results.models.allNonZK = await benchmarkAllNonZK(
        deployments.allNonZK.contract,
        patients,
        iterations
    );
    
    // 2. Hybrid V4 (with encoded proof)
    console.log("\n\n📊 Model 2/3: Hybrid V4 (Unified Interface)");
    console.log("─".repeat(70));
    results.models.hybridV4 = await benchmarkHybridV4(
        deployments.hybridV4.hybridV4Address,
        patients,
        zkProofEncoded,
        iterations
    );
    
    // 3. AllZK (with proof components)
    console.log("\n\n📊 Model 3/3: AllZK (Universal ZK)");
    console.log("─".repeat(70));
    results.models.allZK = await benchmarkAllZK(
        deployments.allZK.allZKAddress,
        patients,
        zkProofComponents,
        iterations
    );
    
    // Calculate comparison metrics
    console.log("\n" + "=".repeat(70));
    console.log("ANALYSIS");
    console.log("=".repeat(70));
    
    const comparison = calculateComparison(results.models, gasPrice);
    results.comparison = comparison;
    
    console.log("\n📈 Per-Access Averages:");
    console.log(`   AllNonZK:  ${Math.round(comparison.avgGas.allNonZK).toLocaleString()} gas`);
    console.log(`   HybridV4:  ${Math.round(comparison.avgGas.hybridV4).toLocaleString()} gas`);
    console.log(`   AllZK:     ${Math.round(comparison.avgGas.allZK).toLocaleString()} gas`);
    
    console.log("\n💰 Cost Comparison (per access @ current gas price):");
    console.log(`   AllNonZK:  ${comparison.costPerAccess.allNonZK} ETH`);
    console.log(`   HybridV4:  ${comparison.costPerAccess.hybridV4} ETH`);
    console.log(`   AllZK:     ${comparison.costPerAccess.allZK} ETH`);
    
    if (comparison.avgGas.hybridV4 > 0 && comparison.avgGas.allZK > 0) {
        console.log("\n🔄 HybridV4 vs AllZK:");
        console.log(`   Gas reduction: ${comparison.hybridVsAllZK.gasReduction}%`);
        console.log(`   Cost reduction: ${comparison.hybridVsAllZK.costReduction}%`);
        
        console.log("\n🔄 HybridV4 vs AllNonZK:");
        console.log(`   Gas overhead: ${comparison.hybridVsNonZK.gasIncrease}%`);
        console.log(`   Cost overhead: ${comparison.hybridVsNonZK.costIncrease}%`);
        
        console.log("\n🔐 Privacy-Performance Trade-off:");
        console.log(`   HybridV4 achieves ${comparison.hybridVsAllZK.gasReduction}% gas savings vs AllZK`);
        console.log(`   while adding only ${comparison.hybridVsNonZK.gasIncrease}% overhead vs AllNonZK`);
        console.log(`   Privacy: Unified interface + internal routing (no explicit pathway revelation)`);
    }
    
    // Success rates
    console.log("\n✅ Success Rates:");
    console.log(`   AllNonZK:  ${comparison.successRates.allNonZK}`);
    console.log(`   HybridV4:  ${comparison.successRates.hybridV4}`);
    console.log(`   AllZK:     ${comparison.successRates.allZK}`);
    
    // Save results
    const outputPath = path.join(__dirname, '../../benchmark-testnet-v4-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ BENCHMARKING COMPLETE");
    console.log("=".repeat(70));
    console.log(`\n💾 Results saved to: benchmark-testnet-v4-results.json`);
    console.log(`📊 Total iterations: ${iterations * 3} (${iterations} per model)`);
    console.log(`💸 Total cost: ~${results.comparison.totalCost} ETH`);
    console.log(`\n🎓 Key Findings:`);
    console.log(`   • HybridV4 uses unified interface (no pathway revelation)`);
    console.log(`   • Gas differential: ${comparison.hybridVsAllZK.gasReduction}% savings vs AllZK`);
    console.log(`   • Privacy enhancement: Internal routing only`);
    
    return results;
}

async function benchmarkAllNonZK(contractAddress, patients, iterations) {
    const contract = await ethers.getContractAt("AllNonZKAccess", contractAddress);
    const results = { accessAttempts: [], totalGas: 0n };
    
    console.log(`Running ${iterations} iterations...`);
    
    for (let i = 0; i < iterations; i++) {
        console.log(`\nIteration ${i + 1}/${iterations}`);
        
        for (const patient of patients) {
            const patientId = ethers.id(patient.patientId);
            
            try {
                const tx = await contract.requestAccess(patientId);
                const receipt = await tx.wait();
                
                results.accessAttempts.push({
                    patientId: patient.patientId,
                    sensitivity: patient.sensitivity,
                    gasUsed: receipt.gasUsed.toString(),
                    status: "success"
                });
                
                results.totalGas += receipt.gasUsed;
                
                process.stdout.write(`\r   Progress: ${results.accessAttempts.length}/${patients.length * iterations}`);
            } catch (error) {
                console.error(`\n   ❌ Failed for patient ${patient.patientId}:`, error.message);
                results.accessAttempts.push({
                    patientId: patient.patientId,
                    sensitivity: patient.sensitivity,
                    gasUsed: "0",
                    status: "failed",
                    error: error.message
                });
            }
        }
    }
    
    console.log("\n   ✓ Complete");
    
    const successCount = results.accessAttempts.filter(a => a.status === "success").length;
    
    return {
        totalGas: results.totalGas.toString(),
        accessCount: results.accessAttempts.length,
        successCount,
        avgGasPerAccess: successCount > 0 ? Number(results.totalGas) / successCount : 0,
        attempts: results.accessAttempts
    };
}

async function benchmarkHybridV4(contractAddress, patients, zkProofEncoded, iterations) {
    const contract = await ethers.getContractAt("HybridEHRAccessV4", contractAddress);
    const results = { 
        accessAttempts: [], 
        totalGas: 0n,
        routineGas: 0n,
        sensitiveGas: 0n,
        routineCount: 0,
        sensitiveCount: 0
    };
    
    console.log(`Running ${iterations} iterations...`);
    console.log("   Using HybridEHRAccessV4 (unified interface)");
    console.log("   Function: requestAccess(patientId, zkProof)");
    
    for (let i = 0; i < iterations; i++) {
        console.log(`\nIteration ${i + 1}/${iterations}`);
        
        for (const patient of patients) {
            const patientId = ethers.id(patient.patientId);
            const isSensitive = patient.sensitivity === 'SENSITIVE';
            
            try {
                // Unified interface: same function for both types
                const tx = await contract.requestAccess(
                    patientId,
                    isSensitive ? zkProofEncoded : '0x' // Empty bytes for routine
                );
                const receipt = await tx.wait();
                
                results.accessAttempts.push({
                    patientId: patient.patientId,
                    sensitivity: patient.sensitivity,
                    gasUsed: receipt.gasUsed.toString(),
                    status: "success"
                });
                
                results.totalGas += receipt.gasUsed;
                
                if (isSensitive) {
                    results.sensitiveGas += receipt.gasUsed;
                    results.sensitiveCount++;
                } else {
                    results.routineGas += receipt.gasUsed;
                    results.routineCount++;
                }
                
                process.stdout.write(`\r   Progress: ${results.accessAttempts.length}/${patients.length * iterations}`);
            } catch (error) {
                console.error(`\n   ❌ Failed for patient ${patient.patientId}:`, error.message);
                results.accessAttempts.push({
                    patientId: patient.patientId,
                    sensitivity: patient.sensitivity,
                    gasUsed: "0",
                    status: "failed",
                    error: error.message
                });
            }
        }
    }
    
    console.log("\n   ✓ Complete");
    console.log(`   Breakdown: ${results.routineCount} routine, ${results.sensitiveCount} sensitive`);
    
    const successCount = results.accessAttempts.filter(a => a.status === "success").length;
    
    return {
        totalGas: results.totalGas.toString(),
        routineGas: results.routineGas.toString(),
        sensitiveGas: results.sensitiveGas.toString(),
        routineCount: results.routineCount,
        sensitiveCount: results.sensitiveCount,
        avgGasPerAccess: successCount > 0 ? Number(results.totalGas) / successCount : 0,
        avgRoutineGas: results.routineCount > 0 ? Number(results.routineGas) / results.routineCount : 0,
        avgSensitiveGas: results.sensitiveCount > 0 ? Number(results.sensitiveGas) / results.sensitiveCount : 0,
        accessCount: results.accessAttempts.length,
        successCount,
        attempts: results.accessAttempts
    };
}

async function benchmarkAllZK(contractAddress, patients, zkProofComponents, iterations) {
    const contract = await ethers.getContractAt("AllZKAccess", contractAddress);
    const results = { accessAttempts: [], totalGas: 0n };
    
    console.log(`Running ${iterations} iterations...`);
    console.log("   Using AllZKAccess interface (proof components)");
    
    for (let i = 0; i < iterations; i++) {
        console.log(`\nIteration ${i + 1}/${iterations}`);
        
        for (const patient of patients) {
            const patientId = ethers.id(patient.patientId);
            
            try {
                const tx = await contract.requestAccess(
                    patientId,
                    zkProofComponents.proof_a,
                    zkProofComponents.proof_b,
                    zkProofComponents.proof_c,
                    zkProofComponents.publicSignals
                );
                const receipt = await tx.wait();
                
                results.accessAttempts.push({
                    patientId: patient.patientId,
                    sensitivity: patient.sensitivity,
                    gasUsed: receipt.gasUsed.toString(),
                    status: "success"
                });
                
                results.totalGas += receipt.gasUsed;
                
                process.stdout.write(`\r   Progress: ${results.accessAttempts.length}/${patients.length * iterations}`);
            } catch (error) {
                console.error(`\n   ❌ Failed for patient ${patient.patientId}:`, error.shortMessage || error.message);
                results.accessAttempts.push({
                    patientId: patient.patientId,
                    sensitivity: patient.sensitivity,
                    gasUsed: "0",
                    status: "failed",
                    error: error.shortMessage || error.message
                });
            }
        }
    }
    
    console.log("\n   ✓ Complete");
    
    const successCount = results.accessAttempts.filter(a => a.status === "success").length;
    
    return {
        totalGas: results.totalGas.toString(),
        accessCount: results.accessAttempts.length,
        successCount,
        avgGasPerAccess: successCount > 0 ? Number(results.totalGas) / successCount : 0,
        attempts: results.accessAttempts
    };
}

function calculateComparison(models, gasPrice) {
    const avgGas = {
        allNonZK: models.allNonZK.avgGasPerAccess || 0,
        hybridV4: models.hybridV4.avgGasPerAccess || 0,
        allZK: models.allZK.avgGasPerAccess || 0
    };
    
    const costPerAccess = {
        allNonZK: ethers.formatEther(BigInt(Math.round(avgGas.allNonZK)) * gasPrice),
        hybridV4: ethers.formatEther(BigInt(Math.round(avgGas.hybridV4)) * gasPrice),
        allZK: ethers.formatEther(BigInt(Math.round(avgGas.allZK)) * gasPrice)
    };
    
    const totalCost = ethers.formatEther(
        (BigInt(models.allNonZK.totalGas) + 
         BigInt(models.hybridV4.totalGas) + 
         BigInt(models.allZK.totalGas)) * gasPrice
    );
    
    const hybridVsAllZK = avgGas.allZK > 0 ? {
        gasReduction: ((avgGas.allZK - avgGas.hybridV4) / avgGas.allZK * 100).toFixed(2),
        costReduction: ((parseFloat(costPerAccess.allZK) - parseFloat(costPerAccess.hybridV4)) / parseFloat(costPerAccess.allZK) * 100).toFixed(2)
    } : { gasReduction: "N/A", costReduction: "N/A" };
    
    const hybridVsNonZK = avgGas.allNonZK > 0 ? {
        gasIncrease: ((avgGas.hybridV4 - avgGas.allNonZK) / avgGas.allNonZK * 100).toFixed(2),
        costIncrease: ((parseFloat(costPerAccess.hybridV4) - parseFloat(costPerAccess.allNonZK)) / parseFloat(costPerAccess.allNonZK) * 100).toFixed(2)
    } : { gasIncrease: "N/A", costIncrease: "N/A" };
    
    return {
        avgGas,
        costPerAccess,
        totalCost,
        hybridVsAllZK,
        hybridVsNonZK,
        successRates: {
            allNonZK: `${models.allNonZK.successCount}/${models.allNonZK.accessCount}`,
            hybridV4: `${models.hybridV4.successCount}/${models.hybridV4.accessCount}`,
            allZK: `${models.allZK.successCount}/${models.allZK.accessCount}`
        },
        hybridBreakdown: {
            routineAvg: models.hybridV4.avgRoutineGas,
            sensitiveAvg: models.hybridV4.avgSensitiveGas,
            routineCount: models.hybridV4.routineCount,
            sensitiveCount: models.hybridV4.sensitiveCount
        }
    };
}

function loadDeployments() {
    const deploymentsDir = path.join(__dirname, '../..');
    
    const deployments = {};
    
    try {
        deployments.allNonZK = JSON.parse(
            fs.readFileSync(path.join(deploymentsDir, 'deployment-allnonzk-testnet.json'), 'utf8')
        );
    } catch (e) {
        console.warn("⚠️  AllNonZK deployment not found");
    }
    
    try {
        deployments.hybridV4 = JSON.parse(
            fs.readFileSync(path.join(deploymentsDir, 'deployment-hybrid-v4-testnet.json'), 'utf8')
        );
    } catch (e) {
        console.warn("⚠️  HybridV4 deployment not found");
    }
    
    try {
        deployments.allZK = JSON.parse(
            fs.readFileSync(path.join(deploymentsDir, 'deployment-allzk-testnet.json'), 'utf8')
        );
    } catch (e) {
        console.warn("⚠️  AllZK deployment not found");
    }
    
    return deployments;
}

function encodeProof(solidityProof) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[1]"],
        [
            solidityProof.proof_a,
            solidityProof.proof_b,
            solidityProof.proof_c,
            solidityProof.publicSignals
        ]
    );
}

// Execute if run directly
if (require.main === module) {
    const iterations = parseInt(process.argv[2]) || 10;
    
    console.log(`\n🎯 Starting V4 testnet benchmark with ${iterations} iterations per model`);
    console.log(`   Total access requests: ${iterations * 16 * 3} (16 patients × ${iterations} iterations × 3 models)\n`);
    
    benchmarkTestnetV4(iterations)
        .then(() => process.exit(0))
        .catch(error => {
            console.error("\n❌ Benchmarking failed:", error);
            process.exit(1);
        });
}

module.exports = benchmarkTestnetV4;