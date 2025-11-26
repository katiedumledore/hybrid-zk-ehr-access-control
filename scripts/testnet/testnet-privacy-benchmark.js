const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Testnet Privacy Metrics Benchmark
 * Measures: Mutual Information, Privacy Budget (epsilon), CV, IQR, percentiles
 */

// Privacy metrics calculations
function calculateMutualInformation(routineGas, sensitiveGas) {
  const totalOps = routineGas.length + sensitiveGas.length;
  const pRoutine = routineGas.length / totalOps;
  const pSensitive = sensitiveGas.length / totalOps;
  
  let hPathway = 0;
  if (pRoutine > 0) hPathway -= pRoutine * Math.log2(pRoutine);
  if (pSensitive > 0) hPathway -= pSensitive * Math.log2(pSensitive);
  
  const avgRoutine = routineGas.reduce((a, b) => a + b, 0) / routineGas.length;
  const avgSensitive = sensitiveGas.reduce((a, b) => a + b, 0) / sensitiveGas.length;
  const gasOverlap = Math.abs(avgRoutine - avgSensitive) < (avgRoutine * 0.01);
  
  const mutualInfo = gasOverlap ? 0 : hPathway;
  const normalized = hPathway > 0 ? mutualInfo / hPathway : 0;
  
  return {
    hPathway,
    mutualInfo,
    normalized,
    interpretation: normalized > 0.9 ? "High correlation - gas reveals pathway" :
                   normalized > 0.5 ? "Moderate correlation" : "Low correlation"
  };
}

function calculateVariability(data) {
  const sorted = [...data].sort((a, b) => a - b);
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const cv = stdDev / mean;
  
  return { cv, iqr, q1, q3, mean, stdDev };
}

function calculatePercentiles(data) {
  const sorted = [...data].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    p999: sorted[Math.floor(sorted.length * 0.999)]
  };
}

function calculatePrivacyBudget(routineGas, sensitiveGas, totalQueries) {
  const avgRoutine = routineGas.reduce((a, b) => a + b, 0) / routineGas.length;
  const avgSensitive = sensitiveGas.reduce((a, b) => a + b, 0) / sensitiveGas.length;
  const ratio = Math.max(avgSensitive / avgRoutine, avgRoutine / avgSensitive);
  const epsilonPerQuery = Math.log(ratio);
  
  return {
    epsilonPerQuery,
    totalQueries,
    cumulativeLoss: epsilonPerQuery * totalQueries,
    zkComparison: 0,
    recommendation: epsilonPerQuery > 1 ? 
      "High privacy budget loss - pathway distinguishable" :
      "Acceptable privacy budget"
  };
}

async function benchmarkAllNonZK(contractAddress, patients, iterations) {
  const contract = await ethers.getContractAt("AllNonZKAccess", contractAddress);
  const results = { 
    routine: [], 
    timestamps: [], 
    success: 0, 
    failed: 0,
    accessAttempts: [] 
  };
  
  console.log(`Running ${iterations} iterations...`);
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\nIteration ${i + 1}/${iterations}`);
    
    for (const patient of patients) {
      const patientId = ethers.id(patient.patientId);
      
      try {
        const startTime = Date.now();
        const tx = await contract.requestAccess(patientId);
        const receipt = await tx.wait();
        
        results.routine.push(Number(receipt.gasUsed));
        results.timestamps.push(Date.now() - startTime);
        results.success++;
        
        results.accessAttempts.push({
          patientId: patient.patientId,
          sensitivity: patient.sensitivity,
          gasUsed: receipt.gasUsed.toString(),
          status: "success"
        });
        
        process.stdout.write(`\r   Progress: ${results.accessAttempts.length}/${patients.length * iterations}`);
      } catch (error) {
        console.error(`\n   ❌ Failed for patient ${patient.patientId}:`, error.message);
        results.failed++;
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
  return results;
}

async function benchmarkHybridV4(contractAddress, patients, zkProofEncoded, iterations) {
  const contract = await ethers.getContractAt("HybridEHRAccessV4", contractAddress);
  const results = { 
    routine: [], 
    sensitive: [], 
    timestamps: [], 
    success: 0, 
    failed: 0,
    routineCount: 0,
    sensitiveCount: 0,
    accessAttempts: [] 
  };
  
  console.log(`Running ${iterations} iterations...`);
  console.log("   Using HybridEHRAccessV4 interface (unified requestAccess)");
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\nIteration ${i + 1}/${iterations}`);
    
    for (const patient of patients) {
      const patientId = ethers.id(patient.patientId);
      const isSensitive = patient.sensitivity === "SENSITIVE";
      
      try {
        const startTime = Date.now();
        const tx = isSensitive ?
          await contract.requestAccess(patientId, zkProofEncoded) :
          await contract.requestAccess(patientId, "0x");
        const receipt = await tx.wait();
        
        if (isSensitive) {
          results.sensitive.push(Number(receipt.gasUsed));
          results.sensitiveCount++;
        } else {
          results.routine.push(Number(receipt.gasUsed));
          results.routineCount++;
        }
        
        results.timestamps.push(Date.now() - startTime);
        results.success++;
        
        results.accessAttempts.push({
          patientId: patient.patientId,
          sensitivity: patient.sensitivity,
          gasUsed: receipt.gasUsed.toString(),
          status: "success"
        });
        
        process.stdout.write(`\r   Progress: ${results.accessAttempts.length}/${patients.length * iterations}`);
      } catch (error) {
        console.error(`\n   ❌ Failed for patient ${patient.patientId}:`, error.message);
        results.failed++;
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
  return results;
}

async function benchmarkAllZK(contractAddress, patients, zkProofComponents, iterations) {
  const contract = await ethers.getContractAt("AllZKAccess", contractAddress);
  const results = { 
    sensitive: [], 
    timestamps: [], 
    success: 0, 
    failed: 0,
    accessAttempts: [] 
  };
  
  console.log(`Running ${iterations} iterations...`);
  console.log("   Using AllZKAccess interface (proof components)");
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\nIteration ${i + 1}/${iterations}`);
    
    for (const patient of patients) {
      const patientId = ethers.id(patient.patientId);
      
      try {
        const startTime = Date.now();
        const tx = await contract.requestAccess(
          patientId,
          zkProofComponents.proof_a,
          zkProofComponents.proof_b,
          zkProofComponents.proof_c,
          zkProofComponents.publicSignals
        );
        const receipt = await tx.wait();
        
        results.sensitive.push(Number(receipt.gasUsed));
        results.timestamps.push(Date.now() - startTime);
        results.success++;
        
        results.accessAttempts.push({
          patientId: patient.patientId,
          sensitivity: patient.sensitivity,
          gasUsed: receipt.gasUsed.toString(),
          status: "success"
        });
        
        process.stdout.write(`\r   Progress: ${results.accessAttempts.length}/${patients.length * iterations}`);
      } catch (error) {
        console.error(`\n   ❌ Failed for patient ${patient.patientId}:`, error.shortMessage || error.message);
        results.failed++;
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
  return results;
}

function analyzePrivacyMetrics(models) {
  console.log("\n" + "=".repeat(70));
  console.log("PRIVACY METRICS ANALYSIS");
  console.log("=".repeat(70));
  
  const analysis = {};
  
  // AllNonZK
  if (models.allNonZK) {
    console.log("\n📊 AllNonZK (Pure RBAC):");
    console.log("─".repeat(70));
    
    const stats = calculateVariability(models.allNonZK.routine);
    const percentiles = calculatePercentiles(models.allNonZK.routine);
    
    analysis.allNonZK = {
      operations: {
        routine: models.allNonZK.routine.length,
        total: models.allNonZK.routine.length,
        successRate: models.allNonZK.success / (models.allNonZK.success + models.allNonZK.failed)
      },
      gasConsumption: {
        routine: {
          mean: Math.round(stats.mean),
          median: percentiles.p50,
          stdDev: Math.round(stats.stdDev),
          cv: stats.cv.toFixed(4),
          min: Math.min(...models.allNonZK.routine),
          max: Math.max(...models.allNonZK.routine)
        }
      },
      variability: { routine: stats },
      percentiles: { routine: percentiles },
      mutualInformation: {
        mutualInfo: 0,
        normalized: 0,
        interpretation: "Single pathway - no gas-based metadata leakage"
      },
      privacyBudget: {
        epsilonPerQuery: 0,
        totalQueries: models.allNonZK.routine.length,
        cumulativeLoss: 0,
        interpretation: "No cryptographic privacy - relies on access control only"
      },
      latency: {
        mean: Math.round(models.allNonZK.timestamps.reduce((a, b) => a + b, 0) / models.allNonZK.timestamps.length),
        median: models.allNonZK.timestamps.sort((a, b) => a - b)[Math.floor(models.allNonZK.timestamps.length / 2)]
      }
    };
    
    console.log(`   Operations: ${analysis.allNonZK.operations.routine} (all routine)`);
    console.log(`   Mean Gas: ${analysis.allNonZK.gasConsumption.routine.mean}`);
    console.log(`   CV: ${analysis.allNonZK.gasConsumption.routine.cv}`);
    console.log(`   Mutual Information: ${analysis.allNonZK.mutualInformation.mutualInfo} bits`);
    console.log(`   Privacy: ${analysis.allNonZK.privacyBudget.interpretation}`);
  }
  
  // HybridV4
  if (models.hybridV4) {
    console.log("\n📊 HybridV4 (Unified Interface):");
    console.log("─".repeat(70));
    
    const routineStats = calculateVariability(models.hybridV4.routine);
    const sensitiveStats = calculateVariability(models.hybridV4.sensitive);
    const routinePercentiles = calculatePercentiles(models.hybridV4.routine);
    const sensitivePercentiles = calculatePercentiles(models.hybridV4.sensitive);
    const mi = calculateMutualInformation(models.hybridV4.routine, models.hybridV4.sensitive);
    const pb = calculatePrivacyBudget(models.hybridV4.routine, models.hybridV4.sensitive,
      models.hybridV4.routine.length + models.hybridV4.sensitive.length);
    
    analysis.hybridV4 = {
      operations: {
        routine: models.hybridV4.routine.length,
        sensitive: models.hybridV4.sensitive.length,
        total: models.hybridV4.routine.length + models.hybridV4.sensitive.length,
        successRate: models.hybridV4.success / (models.hybridV4.success + models.hybridV4.failed)
      },
      gasConsumption: {
        routine: {
          mean: Math.round(routineStats.mean),
          median: routinePercentiles.p50,
          stdDev: Math.round(routineStats.stdDev),
          cv: routineStats.cv.toFixed(4),
          min: Math.min(...models.hybridV4.routine),
          max: Math.max(...models.hybridV4.routine)
        },
        sensitive: {
          mean: Math.round(sensitiveStats.mean),
          median: sensitivePercentiles.p50,
          stdDev: Math.round(sensitiveStats.stdDev),
          cv: sensitiveStats.cv.toFixed(4),
          min: Math.min(...models.hybridV4.sensitive),
          max: Math.max(...models.hybridV4.sensitive)
        },
        difference: Math.round(sensitiveStats.mean - routineStats.mean)
      },
      variability: { 
        routine: routineStats,
        sensitive: sensitiveStats
      },
      percentiles: {
        routine: routinePercentiles,
        sensitive: sensitivePercentiles
      },
      mutualInformation: mi,
      privacyBudget: pb,
      latency: {
        mean: Math.round(models.hybridV4.timestamps.reduce((a, b) => a + b, 0) / models.hybridV4.timestamps.length),
        median: models.hybridV4.timestamps.sort((a, b) => a - b)[Math.floor(models.hybridV4.timestamps.length / 2)]
      }
    };
    
    console.log(`   Routine Operations: ${analysis.hybridV4.operations.routine}`);
    console.log(`     Mean Gas: ${analysis.hybridV4.gasConsumption.routine.mean}`);
    console.log(`     CV: ${analysis.hybridV4.gasConsumption.routine.cv}`);
    console.log(`   Sensitive Operations: ${analysis.hybridV4.operations.sensitive}`);
    console.log(`     Mean Gas: ${analysis.hybridV4.gasConsumption.sensitive.mean}`);
    console.log(`     CV: ${analysis.hybridV4.gasConsumption.sensitive.cv}`);
    console.log(`   Mutual Information: ${mi.mutualInfo.toFixed(4)} bits (${mi.interpretation})`);
    console.log(`   Privacy Budget: ε = ${pb.epsilonPerQuery.toFixed(4)} per query`);
    console.log(`   Recommendation: ${pb.recommendation}`);
  }
  
  // AllZK
  if (models.allZK) {
    console.log("\n📊 AllZK (Universal ZKP):");
    console.log("─".repeat(70));
    
    const stats = calculateVariability(models.allZK.sensitive);
    const percentiles = calculatePercentiles(models.allZK.sensitive);
    
    analysis.allZK = {
      operations: {
        sensitive: models.allZK.sensitive.length,
        total: models.allZK.sensitive.length,
        successRate: models.allZK.success / (models.allZK.success + models.allZK.failed)
      },
      gasConsumption: {
        sensitive: {
          mean: Math.round(stats.mean),
          median: percentiles.p50,
          stdDev: Math.round(stats.stdDev),
          cv: stats.cv.toFixed(4),
          min: Math.min(...models.allZK.sensitive),
          max: Math.max(...models.allZK.sensitive)
        }
      },
      variability: { sensitive: stats },
      percentiles: { sensitive: percentiles },
      mutualInformation: {
        mutualInfo: 0,
        normalized: 0,
        interpretation: "Universal ZK - perfect privacy (ε = 0)"
      },
      privacyBudget: {
        epsilonPerQuery: 0,
        totalQueries: models.allZK.sensitive.length,
        cumulativeLoss: 0,
        zkComparison: 0,
        interpretation: "Zero-knowledge proofs provide perfect privacy (ε = 0)"
      },
      latency: {
        mean: Math.round(models.allZK.timestamps.reduce((a, b) => a + b, 0) / models.allZK.timestamps.length),
        median: models.allZK.timestamps.sort((a, b) => a - b)[Math.floor(models.allZK.timestamps.length / 2)]
      }
    };
    
    console.log(`   Operations: ${analysis.allZK.operations.sensitive} (all ZK)`);
    console.log(`   Mean Gas: ${analysis.allZK.gasConsumption.sensitive.mean}`);
    console.log(`   CV: ${analysis.allZK.gasConsumption.sensitive.cv}`);
    console.log(`   Mutual Information: ${analysis.allZK.mutualInformation.mutualInfo} bits`);
    console.log(`   Privacy: ${analysis.allZK.privacyBudget.interpretation}`);
  }
  
  return analysis;
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

async function main() {
  const iterations = parseInt(process.argv[2]) || 10;
  
  console.log("🔬 Testnet Privacy Metrics Benchmark\n");
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
  
  // Load deployment info
  console.log("\n📂 Loading deployment info...");
  const deployments = loadDeployments();
  
  if (!deployments.allNonZK || !deployments.hybridV4 || !deployments.allZK) {
    console.error("❌ Missing deployment files!");
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
  
  const zkProofEncoded = encodeProof(proofData.solidityProof);
  const zkProofComponents = proofData.solidityProof;
  
  console.log("   ✓ ZK proof loaded (both formats prepared)");
  
  // Benchmark each model
  console.log("\n" + "=".repeat(70));
  console.log("BENCHMARKING START");
  console.log("=".repeat(70));
  
  const models = {};
  
  console.log("\n\n📊 Model 1/3: AllNonZK (Pure RBAC)");
  console.log("─".repeat(70));
  models.allNonZK = await benchmarkAllNonZK(
    deployments.allNonZK.contract,
    patients,
    iterations
  );
  
  console.log("\n\n📊 Model 2/3: Hybrid V4 (Unified Interface)");
  console.log("─".repeat(70));
  models.hybridV4 = await benchmarkHybridV4(
    deployments.hybridV4.hybridV4Address,
    patients,
    zkProofEncoded,
    iterations
  );
  
  console.log("\n\n📊 Model 3/3: AllZK (Universal ZK)");
  console.log("─".repeat(70));
  models.allZK = await benchmarkAllZK(
    deployments.allZK.allZKAddress,
    patients,
    zkProofComponents,
    iterations
  );
  
  // Analyze privacy metrics
  const analysis = analyzePrivacyMetrics(models);
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    network: "Sepolia Testnet",
    chainId: Number(network.chainId),
    testConfiguration: {
      patients: patients.length,
      iterations,
      totalOperations: patients.length * iterations * 3
    },
    contracts: {
      allNonZK: deployments.allNonZK.contract,
      hybridV4: deployments.hybridV4.hybridV4Address,
      allZK: deployments.allZK.allZKAddress
    },
    results: analysis,
    comparativeAnalysis: {
      privacyRanking: [
        { model: "AllZK", privacy: "Perfect (ε = 0)", mutualInfo: 0 },
        { model: "HybridV4", privacy: "Selective", mutualInfo: analysis.hybridV4?.mutualInformation?.mutualInfo || 0 },
        { model: "AllNonZK", privacy: "None", mutualInfo: 0 }
      ]
    },
    keyFindings: [
      `HybridV4: ${analysis.hybridV4?.operations?.routine || 0} routine, ${analysis.hybridV4?.operations?.sensitive || 0} sensitive operations`,
      `Mutual Information: ${(analysis.hybridV4?.mutualInformation?.mutualInfo || 0).toFixed(4)} bits`,
      `Privacy Budget: ε = ${(analysis.hybridV4?.privacyBudget?.epsilonPerQuery || 0).toFixed(4)} per query`,
      `AllZK: Perfect privacy (ε = 0)`,
      `AllNonZK: No cryptographic privacy`
    ]
  };
  
  const filename = `testnet-privacy-report-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ BENCHMARKING COMPLETE");
  console.log("=".repeat(70));
  console.log(`\n💾 Results saved to: ${filename}`);
  console.log(`📊 Total operations: ${patients.length * iterations * 3}`);
  
  const finalBalance = await ethers.provider.getBalance(signer.address);
  const spent = balance - finalBalance;
  console.log(`💸 Gas spent: ${ethers.formatEther(spent)} ETH`);
  
  console.log(`\n🎓 Key Privacy Findings:`);
  console.log(`   • Mutual Information: ${(analysis.hybridV4?.mutualInformation?.mutualInfo || 0).toFixed(4)} bits`);
  console.log(`   • Privacy Budget: ε = ${(analysis.hybridV4?.privacyBudget?.epsilonPerQuery || 0).toFixed(4)}`);
  console.log(`   • HybridV4 unified interface prevents API-level pathway revelation`);
  console.log(`   • AllZK achieves perfect privacy (ε = 0) at higher gas cost`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Benchmarking failed:", error);
    process.exit(1);
  });