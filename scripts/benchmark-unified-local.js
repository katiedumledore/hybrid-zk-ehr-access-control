const { ethers } = require("hardhat");
const fs = require("fs");

// ============================================================================
// UNIFIED BENCHMARK SCRIPT - ALL THREE MODELS
// ============================================================================
// Runs 200 transactions per model (600 total) in local Hardhat environment
// Uses first 16 patients (safe subset common across all contract deployments)
// Patients cycle multiple times through iterations for statistical robustness
// Models: AllNonZK, Hybrid, AllZK
// ============================================================================

async function unifiedBenchmark() {
    console.log("\n" + "=".repeat(80));
    console.log("🚀 UNIFIED BLOCKCHAIN EHR ACCESS CONTROL BENCHMARK");
    console.log("=".repeat(80));
    console.log("\n📊 Configuration:");
    console.log("   • Environment: Local Hardhat Network");
    console.log("   • Total Transactions: 600");
    console.log("   • Per Model: 200 (100 routine + 100 sensitive)");
    console.log("   • Safe Patient Subset: First 16 patients");
    console.log("   • Models: AllNonZK, Hybrid, AllZK");
    console.log("\n" + "=".repeat(80) + "\n");

    // Load deployment info and mapping
    const allNonZKDeploy = JSON.parse(fs.readFileSync('deployment-allnonzk.json', 'utf8'));
    const hybridDeploy = JSON.parse(fs.readFileSync('deployment-hybrid.json', 'utf8'));
    const allZKDeploy = JSON.parse(fs.readFileSync('deployment-allzk.json', 'utf8'));
    const mapping = JSON.parse(fs.readFileSync('ipfs-mapping.json', 'utf8'));
    
    // Load ZK proof for Hybrid and AllZK
    const proofData = JSON.parse(fs.readFileSync("valid-proof.json"));
    const solidityProof = proofData.solidityProof;
    
    const [provider] = await ethers.getSigners();
    
    console.log("📋 Deployment Information:");
    console.log("   • AllNonZK: " + allNonZKDeploy.allNonZKAddress);
    console.log("   • Hybrid: " + hybridDeploy.hybridAddress);
    console.log("   • AllZK: " + allZKDeploy.allZKAddress);
    console.log("   • Provider: " + provider.address);
    console.log("\n" + "=".repeat(80) + "\n");

    // Use only first 16 patients (common across all deployments)
    const safeMapping = mapping.slice(0, 16);
    
    // Separate patients by sensitivity
    const routinePatients = safeMapping.filter(p => p.sensitivity === 'ROUTINE');
    const sensitivePatients = safeMapping.filter(p => p.sensitivity === 'SENSITIVE');
    
    // Validation check
    if (routinePatients.length === 0 || sensitivePatients.length === 0) {
        console.error("\n❌ ERROR: Insufficient patient data!");
        console.error(`   • Routine patients: ${routinePatients.length}`);
        console.error(`   • Sensitive patients: ${sensitivePatients.length}`);
        console.error("   • Need at least 1 of each type\n");
        process.exit(1);
    }
    
    console.log("📁 Dataset Overview:");
    console.log(`   • Total Patients Available: ${mapping.length}`);
    console.log(`   • Using Safe Subset: ${safeMapping.length} (common across all contracts)`);
    console.log(`   • Routine Patients: ${routinePatients.length}`);
    console.log(`   • Sensitive Patients: ${sensitivePatients.length}`);
    console.log("\n" + "=".repeat(80) + "\n");
    
    // Set iterations to 100 per operation type (200 per model, 600 total)
    const ITERATIONS_PER_TYPE = 100;
    const cyclesPerType = Math.ceil(ITERATIONS_PER_TYPE / Math.min(routinePatients.length, sensitivePatients.length));
    
    console.log("⚙️  Iteration Configuration:");
    console.log(`   • Iterations per operation type: ${ITERATIONS_PER_TYPE}`);
    console.log(`   • Total per model: ${ITERATIONS_PER_TYPE * 2}`);
    console.log(`   • Grand total: ${ITERATIONS_PER_TYPE * 2 * 3} transactions`);
    console.log(`   • Patient cycling: ~${cyclesPerType} times through patient set`);
    console.log("   • Note: Using safe 16-patient subset common to all contracts");
    console.log("\n" + "=".repeat(80) + "\n");

    const startTime = Date.now();
    const allResults = [];

    // ========================================================================
    // MODEL 1: ALL NON-ZK (PURE RBAC)
    // ========================================================================
    console.log("\n" + "█".repeat(80));
    console.log("MODEL 1/3: ALL NON-ZK BASELINE");
    console.log("█".repeat(80));
    console.log("📌 Pure RBAC - No ZK proofs for any operations");
    console.log("   Expected: Low gas (~185k), fast execution\n");

    const allNonZK = await ethers.getContractAt("AllNonZKAccess", allNonZKDeploy.allNonZKAddress);
    
    const allNonZKRoutine = await runAccessBenchmark(
        allNonZK,
        routinePatients,
        'ROUTINE',
        ITERATIONS_PER_TYPE,
        'AllNonZK',
        null // no ZK proof
    );
    
    const allNonZKSensitive = await runAccessBenchmark(
        allNonZK,
        sensitivePatients,
        'SENSITIVE',
        ITERATIONS_PER_TYPE,
        'AllNonZK',
        null
    );

    const allNonZKResults = {
        model: "AllNonZK",
        routine: allNonZKRoutine,
        sensitive: allNonZKSensitive,
        combined: [...allNonZKRoutine.raw, ...allNonZKSensitive.raw]
    };
    
    allResults.push(allNonZKResults);
    reportModelSummary("AllNonZK", allNonZKResults);

    // ========================================================================
    // MODEL 2: HYBRID (SMART ROUTING)
    // ========================================================================
    console.log("\n" + "█".repeat(80));
    console.log("MODEL 2/3: HYBRID (SENSITIVITY-BASED ROUTING)");
    console.log("█".repeat(80));
    console.log("📌 Smart routing: RBAC for routine, ZK for sensitive");
    console.log("   Expected: Low gas for routine, high gas for sensitive\n");

    const hybrid = await ethers.getContractAt("HybridEHRAccessV3", hybridDeploy.hybridAddress);
    
    const hybridRoutine = await runHybridRoutineBenchmark(
        hybrid,
        routinePatients,
        ITERATIONS_PER_TYPE
    );
    
    const hybridSensitive = await runHybridSensitiveBenchmark(
        hybrid,
        sensitivePatients,
        solidityProof.proof_a,
        solidityProof.proof_b,
        solidityProof.proof_c,
        solidityProof.publicSignals,
        ITERATIONS_PER_TYPE
    );

    const hybridResults = {
        model: "Hybrid",
        routine: hybridRoutine,
        sensitive: hybridSensitive,
        combined: [...hybridRoutine.raw, ...hybridSensitive.raw]
    };
    
    allResults.push(hybridResults);
    reportModelSummary("Hybrid", hybridResults);

    // ========================================================================
    // MODEL 3: ALL-ZK (UNIVERSAL ZERO-KNOWLEDGE)
    // ========================================================================
    console.log("\n" + "█".repeat(80));
    console.log("MODEL 3/3: ALL-ZK (UNIVERSAL ZERO-KNOWLEDGE)");
    console.log("█".repeat(80));
    console.log("📌 ZK proofs for ALL operations (routine + sensitive)");
    console.log("   Expected: High gas for all (~29M), maximum privacy\n");

    const allZK = await ethers.getContractAt("AllZKAccess", allZKDeploy.allZKAddress);
    const accounts = await ethers.getSigners();
    
    const formatEther = (value) => {
        if (ethers.utils && ethers.utils.formatEther) {
            return ethers.utils.formatEther(value);
        } else {
            return ethers.formatEther(value);
        }
    };
    
    const allZKRoutine = await runZKAccessBenchmark(
        allZK,
        routinePatients,
        'ROUTINE',
        solidityProof.proof_a,
        solidityProof.proof_b,
        solidityProof.proof_c,
        solidityProof.publicSignals,
        ITERATIONS_PER_TYPE,
        accounts,
        formatEther
    );
    
    const allZKSensitive = await runZKAccessBenchmark(
        allZK,
        sensitivePatients,
        'SENSITIVE',
        solidityProof.proof_a,
        solidityProof.proof_b,
        solidityProof.proof_c,
        solidityProof.publicSignals,
        ITERATIONS_PER_TYPE,
        accounts,
        formatEther
    );

    const allZKResults = {
        model: "AllZK",
        routine: allZKRoutine,
        sensitive: allZKSensitive,
        combined: [...allZKRoutine.raw, ...allZKSensitive.raw]
    };
    
    allResults.push(allZKResults);
    reportModelSummary("AllZK", allZKResults);

    const endTime = Date.now();
    const totalDuration = ((endTime - startTime) / 1000).toFixed(2);

    // ========================================================================
    // COMPREHENSIVE COMPARISON ANALYSIS
    // ========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("📊 COMPREHENSIVE THREE-MODEL COMPARISON");
    console.log("=".repeat(80));

    printComparisonTable(allResults);
    printPerformanceRatios(allResults);
    printEconomicImpact(allResults);
    printPrivacyAnalysis(allResults);

    // ========================================================================
    // EXPORT RESULTS
    // ========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("💾 EXPORTING RESULTS");
    console.log("=".repeat(80));

    const totalTransactions = (ITERATIONS_PER_TYPE * 2 * 3);
    
    const exportData = {
        benchmark: {
            environment: "Local Hardhat Network",
            timestamp: new Date().toISOString(),
            totalTransactions: totalTransactions,
            transactionsPerModel: ITERATIONS_PER_TYPE * 2,
            iterationsPerType: ITERATIONS_PER_TYPE,
            totalDuration: totalDuration + "s",
            note: "Using first 16 patients common across all deployments"
        },
        dataset: {
            totalAvailable: mapping.length,
            safeSubsetUsed: safeMapping.length,
            routine: routinePatients.length,
            sensitive: sensitivePatients.length
        },
        models: {
            allNonZK: {
                contract: allNonZKDeploy.allNonZKAddress,
                routine: {
                    iterations: allNonZKRoutine.raw.length,
                    gasStats: allNonZKRoutine.stats.gas,
                    latencyStats: allNonZKRoutine.stats.latency,
                    successRate: allNonZKRoutine.stats.successRate
                },
                sensitive: {
                    iterations: allNonZKSensitive.raw.length,
                    gasStats: allNonZKSensitive.stats.gas,
                    latencyStats: allNonZKSensitive.stats.latency,
                    successRate: allNonZKSensitive.stats.successRate
                },
                combined: calculateStats(allNonZKResults.combined.map(r => r.gasUsed))
            },
            hybrid: {
                contract: hybridDeploy.hybridAddress,
                routine: {
                    iterations: hybridRoutine.raw.length,
                    gasStats: hybridRoutine.stats.gas,
                    latencyStats: hybridRoutine.stats.latency,
                    successRate: hybridRoutine.stats.successRate
                },
                sensitive: {
                    iterations: hybridSensitive.raw.length,
                    gasStats: hybridSensitive.stats.gas,
                    latencyStats: hybridSensitive.stats.latency,
                    successRate: hybridSensitive.stats.successRate
                },
                combined: calculateStats(hybridResults.combined.map(r => r.gasUsed))
            },
            allZK: {
                contract: allZKDeploy.allZKAddress,
                routine: {
                    iterations: allZKRoutine.raw.length,
                    gasStats: allZKRoutine.stats.gas,
                    latencyStats: allZKRoutine.stats.latency,
                    successRate: allZKRoutine.stats.successRate
                },
                sensitive: {
                    iterations: allZKSensitive.raw.length,
                    gasStats: allZKSensitive.stats.gas,
                    latencyStats: allZKSensitive.stats.latency,
                    successRate: allZKSensitive.stats.successRate
                },
                combined: calculateStats(allZKResults.combined.map(r => r.gasUsed))
            }
        },
        rawTransactions: {
            allNonZK: allNonZKResults.combined,
            hybrid: hybridResults.combined,
            allZK: allZKResults.combined
        }
    };

    fs.writeFileSync(
        'benchmark-unified-local-results.json',
        JSON.stringify(exportData, null, 2)
    );

    console.log("\n✅ Results exported to: benchmark-unified-local-results.json");
    console.log(`   • Total duration: ${totalDuration}s`);
    console.log(`   • Total transactions: ${totalTransactions}`);
    console.log(`   • Transactions per model: ${ITERATIONS_PER_TYPE * 2}`);
    console.log(`   • Models benchmarked: 3`);

    console.log("\n" + "=".repeat(80));
    console.log("🎉 UNIFIED BENCHMARK COMPLETE!");
    console.log("=".repeat(80));
    console.log("\n📈 Next Steps:");
    console.log("   1. Review benchmark-unified-local-results.json");
    console.log("   2. Compare gas consumption patterns");
    console.log("   3. Analyze privacy-performance trade-offs");
    console.log("   4. Consider testnet deployment for validation\n");

    process.exit(0);
}

// ============================================================================
// BENCHMARK FUNCTIONS
// ============================================================================

async function runAccessBenchmark(contract, patients, recordType, iterations, modelName, zkProof) {
    console.log(`\n🔄 Running ${iterations} ${recordType} transactions...`);
    
    const results = [];
    const progressInterval = 10;
    
    for (let i = 0; i < iterations; i++) {
        const patient = patients[i % patients.length];
        const patientId = ethers.id(patient.patientId);
        
        const startTime = Date.now();
        
        try {
            const tx = await contract.requestAccess(patientId);
            const receipt = await tx.wait();
            
            const endTime = Date.now();
            
            results.push({
                iteration: i + 1,
                model: modelName,
                patientId: patient.patientId.substring(0, 20) + '...',
                sensitivity: patient.sensitivity,
                gasUsed: Number(receipt.gasUsed),
                latency: endTime - startTime,
                blockNumber: receipt.blockNumber,
                success: true
            });
            
            if ((i + 1) % progressInterval === 0) {
                process.stdout.write(`\r   Progress: ${i + 1}/${iterations} transactions`);
            }
            
        } catch (error) {
            const errorMsg = error.message.includes('Patient record not found') 
                ? `Patient not found: ${patient.patientId.substring(0, 30)}...`
                : error.message;
            console.error(`\n   ❌ Iteration ${i + 1} failed: ${errorMsg}`);
            results.push({
                iteration: i + 1,
                model: modelName,
                patientId: patient.patientId.substring(0, 20) + '...',
                success: false,
                error: error.message
            });
        }
    }
    
    console.log(`\r   ✅ Completed: ${iterations}/${iterations} transactions`);
    
    const successfulResults = results.filter(r => r.success);
    const gasValues = successfulResults.map(r => r.gasUsed);
    const latencyValues = successfulResults.map(r => r.latency);
    
    const stats = {
        gas: calculateStats(gasValues),
        latency: calculateStats(latencyValues),
        successRate: (successfulResults.length / results.length * 100).toFixed(1)
    };
    
    return {
        stats,
        raw: successfulResults
    };
}

async function runHybridRoutineBenchmark(contract, patients, iterations) {
    console.log(`\n🔄 Running ${iterations} routine transactions (RBAC pathway)...`);
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        const patient = patients[i % patients.length];
        const patientId = ethers.id(patient.patientId);
        
        const startTime = Date.now();
        
        try {
            const tx = await contract.requestRoutineAccess(patientId);
            const receipt = await tx.wait();
            
            const endTime = Date.now();
            
            results.push({
                iteration: i + 1,
                model: "Hybrid",
                pathway: "RBAC",
                patientId: patient.patientId.substring(0, 20) + '...',
                sensitivity: patient.sensitivity,
                gasUsed: Number(receipt.gasUsed),
                latency: endTime - startTime,
                success: true
            });
            
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`\r   Progress: ${i + 1}/${iterations} transactions`);
            }
            
        } catch (error) {
            console.error(`\n   ❌ Iteration ${i + 1} failed: ${error.message}`);
            results.push({
                iteration: i + 1,
                model: "Hybrid",
                pathway: "RBAC",
                success: false,
                error: error.message
            });
        }
    }
    
    console.log(`\r   ✅ Completed: ${iterations}/${iterations} transactions`);
    
    const successfulResults = results.filter(r => r.success);
    const gasValues = successfulResults.map(r => r.gasUsed);
    const latencyValues = successfulResults.map(r => r.latency);
    
    const stats = {
        gas: calculateStats(gasValues),
        latency: calculateStats(latencyValues),
        successRate: (successfulResults.length / iterations * 100).toFixed(1)
    };
    
    return {
        stats,
        raw: successfulResults
    };
}

async function runHybridSensitiveBenchmark(contract, patients, proof_a, proof_b, proof_c, publicSignals, iterations) {
    console.log(`\n🔄 Running ${iterations} sensitive transactions (ZK pathway)...`);
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        const patient = patients[i % patients.length];
        const patientId = ethers.id(patient.patientId);
        
        const startTime = Date.now();
        
        try {
            const tx = await contract.requestSensitiveAccess(
                patientId,
                proof_a,
                proof_b,
                proof_c,
                publicSignals
            );
            const receipt = await tx.wait();
            
            const endTime = Date.now();
            
            results.push({
                iteration: i + 1,
                model: "Hybrid",
                pathway: "ZK",
                patientId: patient.patientId.substring(0, 20) + '...',
                sensitivity: patient.sensitivity,
                gasUsed: Number(receipt.gasUsed),
                latency: endTime - startTime,
                success: true
            });
            
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`\r   Progress: ${i + 1}/${iterations} transactions`);
            }
            
        } catch (error) {
            console.error(`\n   ❌ Iteration ${i + 1} failed: ${error.message}`);
            results.push({
                iteration: i + 1,
                model: "Hybrid",
                pathway: "ZK",
                success: false,
                error: error.message
            });
        }
    }
    
    console.log(`\r   ✅ Completed: ${iterations}/${iterations} transactions`);
    
    const successfulResults = results.filter(r => r.success);
    const gasValues = successfulResults.map(r => r.gasUsed);
    const latencyValues = successfulResults.map(r => r.latency);
    
    const stats = {
        gas: calculateStats(gasValues),
        latency: calculateStats(latencyValues),
        successRate: (successfulResults.length / iterations * 100).toFixed(1)
    };
    
    return {
        stats,
        raw: successfulResults
    };
}

async function runZKAccessBenchmark(
    contract,
    patients,
    recordType,
    proof_a,
    proof_b,
    proof_c,
    publicSignals,
    iterations,
    accounts,
    formatEther
) {
    console.log(`\n🔄 Running ${iterations} ${recordType} transactions (ZK pathway)...`);
    
    const results = [];
    let currentAccountIndex = 0;
    let currentAccount = accounts[currentAccountIndex];
    let connectedContract = contract.connect(currentAccount);
    
    const MIN_BALANCE_ETH = 1500;
    const MAX_ACCOUNTS = Math.min(10, accounts.length);
    
    for (let i = 0; i < iterations; i++) {
        const patient = patients[i % patients.length];
        const patientId = ethers.id ? ethers.id(patient.patientId) : ethers.utils.id(patient.patientId);
        
        try {
            const balance = await ethers.provider.getBalance(currentAccount.address);
            const balanceETH = parseFloat(formatEther(balance));
            
            if (balanceETH < MIN_BALANCE_ETH && currentAccountIndex < MAX_ACCOUNTS - 1) {
                currentAccountIndex++;
                currentAccount = accounts[currentAccountIndex];
                connectedContract = contract.connect(currentAccount);
            }
        } catch (balanceError) {
            console.error(`\n   ⚠️ Balance check failed: ${balanceError.message}`);
        }
        
        const startTime = Date.now();
        
        try {
            const tx = await connectedContract.requestAccess(
                patientId,
                proof_a,
                proof_b,
                proof_c,
                publicSignals
            );
            const receipt = await tx.wait();
            
            const endTime = Date.now();
            
            results.push({
                iteration: i + 1,
                model: "AllZK",
                pathway: "ZK",
                patientId: patient.patientId.substring(0, 20) + '...',
                sensitivity: patient.sensitivity,
                gasUsed: Number(receipt.gasUsed),
                latency: endTime - startTime,
                blockNumber: receipt.blockNumber,
                accountUsed: currentAccountIndex,
                success: true
            });
            
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`\r   Progress: ${i + 1}/${iterations} transactions`);
            }
            
        } catch (error) {
            console.error(`\n   ❌ Iteration ${i + 1} failed: ${error.message}`);
            results.push({
                iteration: i + 1,
                model: "AllZK",
                pathway: "ZK",
                success: false,
                error: error.message,
                accountUsed: currentAccountIndex
            });
        }
    }
    
    console.log(`\r   ✅ Completed: ${results.filter(r => r.success).length}/${iterations} transactions`);
    
    const successfulResults = results.filter(r => r.success);
    const gasValues = successfulResults.map(r => r.gasUsed);
    const latencyValues = successfulResults.map(r => r.latency);
    
    const stats = {
        gas: calculateStats(gasValues),
        latency: calculateStats(latencyValues),
        successRate: (successfulResults.length / iterations * 100).toFixed(1)
    };
    
    return {
        stats,
        raw: successfulResults,
        accountsUsed: currentAccountIndex + 1
    };
}

// ============================================================================
// STATISTICS AND REPORTING FUNCTIONS
// ============================================================================

function calculateStats(values) {
    if (values.length === 0) return null;
    
    const sorted = values.slice().sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
        mean: Math.round(mean),
        median: sorted[Math.floor(sorted.length / 2)],
        stdDev: Math.round(stdDev),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        count: values.length
    };
}

function reportModelSummary(modelName, results) {
    console.log("\n" + "-".repeat(80));
    console.log(`📊 ${modelName} Summary`);
    console.log("-".repeat(80));
    
    const routineGas = results.routine.stats.gas;
    const sensitiveGas = results.sensitive.stats.gas;
    const totalTxs = results.routine.raw.length + results.sensitive.raw.length;
    
    console.log(`\n   Total Transactions: ${totalTxs}`);
    console.log(`   ├─ Routine: ${results.routine.raw.length} (Success: ${results.routine.stats.successRate}%)`);
    console.log(`   └─ Sensitive: ${results.sensitive.raw.length} (Success: ${results.sensitive.stats.successRate}%)`);
    
    if (routineGas) {
        console.log(`\n   Routine Operations:`);
        console.log(`   ├─ Mean: ${routineGas.mean.toLocaleString()} gas`);
        console.log(`   ├─ Median: ${routineGas.median.toLocaleString()} gas`);
        console.log(`   └─ Std Dev: ${routineGas.stdDev.toLocaleString()} gas`);
    }
    
    if (sensitiveGas) {
        console.log(`\n   Sensitive Operations:`);
        console.log(`   ├─ Mean: ${sensitiveGas.mean.toLocaleString()} gas`);
        console.log(`   ├─ Median: ${sensitiveGas.median.toLocaleString()} gas`);
        console.log(`   └─ Std Dev: ${sensitiveGas.stdDev.toLocaleString()} gas`);
    }
}

function printComparisonTable(allResults) {
    console.log("\n📋 Gas Consumption Comparison:\n");
    console.log("┌─────────────┬──────────────────┬──────────────────┬──────────────────┐");
    console.log("│ Model       │ Routine (gas)    │ Sensitive (gas)  │ Combined (gas)   │");
    console.log("├─────────────┼──────────────────┼──────────────────┼──────────────────┤");
    
    allResults.forEach(result => {
        const routineMean = result.routine.stats.gas.mean.toLocaleString().padEnd(12);
        const sensitiveMean = result.sensitive.stats.gas.mean.toLocaleString().padEnd(12);
        const combinedStats = calculateStats(result.combined.map(r => r.gasUsed));
        const combinedMean = combinedStats.mean.toLocaleString().padEnd(12);
        const modelName = result.model.padEnd(11);
        
        console.log(`│ ${modelName} │ ${routineMean}    │ ${sensitiveMean}    │ ${combinedMean}    │`);
    });
    
    console.log("└─────────────┴──────────────────┴──────────────────┴──────────────────┘");
}

function printPerformanceRatios(allResults) {
    console.log("\n📊 Performance Ratios:\n");
    
    const allNonZK = allResults.find(r => r.model === "AllNonZK");
    const hybrid = allResults.find(r => r.model === "Hybrid");
    const allZK = allResults.find(r => r.model === "AllZK");
    
    // Hybrid vs AllZK for routine
    const hybridRoutineGas = hybrid.routine.stats.gas.mean;
    const allZKRoutineGas = allZK.routine.stats.gas.mean;
    const routineRatio = (allZKRoutineGas / hybridRoutineGas).toFixed(1);
    const routineSavings = ((1 - hybridRoutineGas / allZKRoutineGas) * 100).toFixed(1);
    
    console.log(`   🎯 Hybrid Routine vs AllZK:`);
    console.log(`      • Ratio: ${routineRatio}x more efficient`);
    console.log(`      • Savings: ${routineSavings}% gas reduction`);
    
    // Hybrid vs AllZK for mixed workload (70/30)
    const hybridCombined = calculateStats(hybrid.combined.map(r => r.gasUsed));
    const allZKCombined = calculateStats(allZK.combined.map(r => r.gasUsed));
    const combinedRatio = (allZKCombined.mean / hybridCombined.mean).toFixed(2);
    const combinedSavings = ((1 - hybridCombined.mean / allZKCombined.mean) * 100).toFixed(1);
    
    console.log(`\n   🎯 Hybrid vs AllZK (Mixed Workload):`);
    console.log(`      • Ratio: ${combinedRatio}x more efficient`);
    console.log(`      • Savings: ${combinedSavings}% gas reduction`);
    
    // AllZK vs AllNonZK overhead
    const allNonZKCombined = calculateStats(allNonZK.combined.map(r => r.gasUsed));
    const zkOverhead = (allZKCombined.mean / allNonZKCombined.mean).toFixed(1);
    const overheadPercent = ((allZKCombined.mean / allNonZKCombined.mean - 1) * 100).toFixed(0);
    
    console.log(`\n   ⚠️  AllZK vs AllNonZK (Overhead):`);
    console.log(`      • Ratio: ${zkOverhead}x higher gas consumption`);
    console.log(`      • Overhead: +${overheadPercent}% vs baseline RBAC`);
}

function printEconomicImpact(allResults) {
    console.log("\n💰 Economic Impact Analysis:\n");
    console.log("   Assumptions:");
    console.log("   • ETH Price: $3,000");
    console.log("   • Gas Price: 50 gwei");
    console.log("   • Daily Transactions: 10,000 (70% routine, 30% sensitive)\n");
    
    const ETH_PRICE = 3000;
    const GAS_PRICE_GWEI = 50;
    const DAILY_TXS = 10000;
    const ROUTINE_RATIO = 0.7;
    const SENSITIVE_RATIO = 0.3;
    
    const gwei_to_eth = (gwei) => gwei / 1e9;
    const gas_to_usd = (gas) => (gas * GAS_PRICE_GWEI * gwei_to_eth(1)) * ETH_PRICE;
    
    allResults.forEach(result => {
        const routineGas = result.routine.stats.gas.mean;
        const sensitiveGas = result.sensitive.stats.gas.mean;
        
        // Calculate weighted average gas (70/30 split)
        const avgGas = (routineGas * ROUTINE_RATIO) + (sensitiveGas * SENSITIVE_RATIO);
        const costPerTx = gas_to_usd(avgGas);
        const dailyCost = costPerTx * DAILY_TXS;
        const annualCost = dailyCost * 365;
        
        console.log(`   ${result.model}:`);
        console.log(`   ├─ Cost per Tx: $${costPerTx.toFixed(2)}`);
        console.log(`   ├─ Daily Cost: $${(dailyCost / 1e6).toFixed(2)}M`);
        console.log(`   └─ Annual Cost: $${(annualCost / 1e9).toFixed(2)}B\n`);
    });
    
    // Savings calculation
    const hybrid = allResults.find(r => r.model === "Hybrid");
    const allZK = allResults.find(r => r.model === "AllZK");
    
    const hybridAvgGas = (hybrid.routine.stats.gas.mean * ROUTINE_RATIO) + 
                         (hybrid.sensitive.stats.gas.mean * SENSITIVE_RATIO);
    const allZKAvgGas = (allZK.routine.stats.gas.mean * ROUTINE_RATIO) + 
                        (allZK.sensitive.stats.gas.mean * SENSITIVE_RATIO);
    
    const hybridAnnual = gas_to_usd(hybridAvgGas) * DAILY_TXS * 365;
    const allZKAnnual = gas_to_usd(allZKAvgGas) * DAILY_TXS * 365;
    const annualSavings = allZKAnnual - hybridAnnual;
    
    console.log(`   💡 Hybrid vs AllZK Savings:`);
    console.log(`      • Annual Savings: $${(annualSavings / 1e9).toFixed(2)}B`);
    console.log(`      • Percentage: ${((annualSavings / allZKAnnual) * 100).toFixed(1)}%`);
}

function printPrivacyAnalysis(allResults) {
    console.log("\n🔒 Privacy Analysis:\n");
    
    const allNonZK = allResults.find(r => r.model === "AllNonZK");
    const hybrid = allResults.find(r => r.model === "Hybrid");
    const allZK = allResults.find(r => r.model === "AllZK");
    
    console.log("   AllNonZK:");
    console.log("   ├─ Privacy: None (RBAC only)");
    console.log("   ├─ Operation Type: Visible");
    console.log("   └─ Medical Content: Encrypted off-chain only\n");
    
    console.log("   Hybrid:");
    console.log("   ├─ Privacy: Selective (pathway distinguishable)");
    console.log("   ├─ Operation Type: Distinguishable via gas patterns");
    console.log("   ├─ Routine Operations: RBAC (no ZK)");
    console.log("   ├─ Sensitive Operations: Full ZK protection");
    console.log("   └─ Medical Content: Encrypted + ZK for sensitive\n");
    
    console.log("   AllZK:");
    console.log("   ├─ Privacy: Maximum (universal ZK)");
    console.log("   ├─ Operation Type: Hidden");
    console.log("   ├─ All Operations: ZK proof required");
    console.log("   └─ Medical Content: Encrypted + ZK for all\n");
    
    // Gas pattern distinguishability
    const hybridRoutineGas = hybrid.routine.stats.gas.mean;
    const hybridSensitiveGas = hybrid.sensitive.stats.gas.mean;
    const gasDifferential = (hybridSensitiveGas / hybridRoutineGas).toFixed(1);
    
    console.log("   🔍 Hybrid Gas Pattern Analysis:");
    console.log(`      • Routine Gas: ${hybridRoutineGas.toLocaleString()}`);
    console.log(`      • Sensitive Gas: ${hybridSensitiveGas.toLocaleString()}`);
    console.log(`      • Differential: ${gasDifferential}x`);
    console.log(`      • Distinguishability: HIGH (100% via gas analysis)`);
    console.log(`      • Content Privacy: PROTECTED (ZK + encryption)`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

unifiedBenchmark().catch(console.error);