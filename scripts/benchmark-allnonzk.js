const { ethers } = require("hardhat");
const fs = require("fs");

async function benchmarkAllNonZK() {
    console.log("📊 BENCHMARKING ALL NON-ZK BASELINE\n");
    console.log("=".repeat(70));
    
    // Load deployment info
    const deployment = JSON.parse(fs.readFileSync('deployment-allnonzk.json', 'utf8'));
    const mapping = JSON.parse(fs.readFileSync('ipfs-mapping.json', 'utf8'));
    
    const [provider] = await ethers.getSigners();
    
    // Connect to contract
    const allNonZK = await ethers.getContractAt("AllNonZKAccess", deployment.allNonZKAddress);
    
    console.log("Contract:", deployment.allNonZKAddress);
    console.log("Provider:", provider.address);
    console.log();
    
    // Separate patients by sensitivity
    const routinePatients = mapping.filter(p => p.sensitivity === 'ROUTINE');
    const sensitivePatients = mapping.filter(p => p.sensitivity === 'SENSITIVE');
    
    console.log(`Dataset: ${routinePatients.length} routine, ${sensitivePatients.length} sensitive`);
    console.log();
    
    // ===== TEST 1: ROUTINE ACCESS (RBAC ONLY) =====
    console.log("=".repeat(70));
    console.log("TEST 1: ROUTINE ACCESS (Pure RBAC)");
    console.log("=".repeat(70));
    
    const routineResults = await runAccessBenchmark(
        allNonZK,
        routinePatients,
        'ROUTINE',
        100  // 100 iterations
    );
    
    reportResults('Routine Access', routineResults);
    
    // ===== TEST 2: SENSITIVE ACCESS (STILL RBAC, NO ZK) =====
    console.log("\n" + "=".repeat(70));
    console.log("TEST 2: SENSITIVE ACCESS (⚠️ Still Pure RBAC, NO ZK Protection)");
    console.log("=".repeat(70));
    
    const sensitiveResults = await runAccessBenchmark(
        allNonZK,
        sensitivePatients,
        'SENSITIVE',
        100  // 100 iterations
    );
    
    reportResults('Sensitive Access', sensitiveResults);
    
    // ===== COMBINED STATISTICS =====
    console.log("\n" + "=".repeat(70));
    console.log("OVERALL ALL NON-ZK STATISTICS");
    console.log("=".repeat(70));
    
    const allResults = [...routineResults.raw, ...sensitiveResults.raw];
    const combinedStats = calculateStats(allResults.map(r => r.gasUsed));
    
    console.log(`\nTotal Transactions: ${allResults.length}`);
    console.log(`  ├─ Routine: ${routineResults.raw.length}`);
    console.log(`  └─ Sensitive: ${sensitiveResults.raw.length}`);
    
    console.log(`\nCombined Gas Consumption:`);
    console.log(`  ├─ Mean: ${combinedStats.mean.toLocaleString()} gas`);
    console.log(`  ├─ Median: ${combinedStats.median.toLocaleString()} gas`);
    console.log(`  ├─ Std Dev: ${combinedStats.stdDev.toLocaleString()} gas`);
    console.log(`  ├─ Min: ${combinedStats.min.toLocaleString()} gas`);
    console.log(`  └─ Max: ${combinedStats.max.toLocaleString()} gas`);
    
    // ===== EXPORT RESULTS =====
    console.log("\n" + "=".repeat(70));
    console.log("EXPORTING RESULTS");
    console.log("=".repeat(70));
    
    const exportData = {
        model: "All Non-ZK (Pure RBAC)",
        timestamp: new Date().toISOString(),
        contract: deployment.allNonZKAddress,
        dataset: {
            routine: routinePatients.length,
            sensitive: sensitivePatients.length,
            total: mapping.length
        },
        results: {
            routine: {
                iterations: routineResults.raw.length,
                gasStats: routineResults.stats,
                rawData: routineResults.raw
            },
            sensitive: {
                iterations: sensitiveResults.raw.length,
                gasStats: sensitiveResults.stats,
                rawData: sensitiveResults.raw
            },
            combined: {
                iterations: allResults.length,
                gasStats: combinedStats,
                note: "Both routine and sensitive use RBAC only - no ZK protection"
            }
        }
    };
    
    fs.writeFileSync(
        'benchmark-allnonzk-results.json',
        JSON.stringify(exportData, null, 2)
    );
    
    console.log("\n✓ Results saved to: benchmark-allnonzk-results.json");
    
    // ===== KEY INSIGHTS =====
    console.log("\n" + "=".repeat(70));
    console.log("🔑 KEY INSIGHTS");
    console.log("=".repeat(70));
    
    console.log("\n✅ All Non-ZK Performance:");
    console.log(`   • Very low gas consumption (${combinedStats.mean.toLocaleString()} gas avg)`);
    console.log(`   • No computational overhead (no ZK proofs)`);
    console.log(`   • Fast response times`);
    
    console.log("\n⚠️  All Non-ZK Privacy Concerns:");
    console.log(`   • NO privacy protection for sensitive records`);
    console.log(`   • Operation types VISIBLE on-chain`);
    console.log(`   • Sensitive access same as routine (just RBAC)`);
    console.log(`   • Medical data patterns potentially inferable`);
    
    console.log("\n📊 Expected Comparison:");
    console.log(`   • All Non-ZK: ~${Math.round(combinedStats.mean / 1000)}k gas (fastest, least private)`);
    console.log(`   • Hybrid: ~185k gas for routine, ~300-400k for sensitive (balanced)`);
    console.log(`   • All-ZK: ~300-400k gas for ALL (slowest, most private)`);
    
    console.log("\n✨ Phase 2.1 Complete!");
    console.log("   Next: Phase 2.2 - Build All-ZK baseline");
    
    process.exit(0);
}

async function runAccessBenchmark(contract, patients, recordType, iterations) {
    console.log(`\nRunning ${iterations} iterations of ${recordType} access...\n`);
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        // Select random patient from this category
        const patient = patients[i % patients.length];
        const patientId = ethers.id(patient.patientId);
        
        const startTime = Date.now();
        
        try {
            // Call contract
            const tx = await contract.requestAccess(patientId);
            const receipt = await tx.wait();
            
            const endTime = Date.now();
            
            results.push({
                iteration: i + 1,
                patientId: patient.patientId.substring(0, 20) + '...',
                sensitivity: patient.sensitivity,
                gasUsed: Number(receipt.gasUsed),
                latency: endTime - startTime,
                blockNumber: receipt.blockNumber,
                success: true
            });
            
            // Progress indicator
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`\r   Progress: ${i + 1}/${iterations}`);
            }
            
        } catch (error) {
            console.error(`\n   ✗ Iteration ${i + 1} failed: ${error.message}`);
            results.push({
                iteration: i + 1,
                success: false,
                error: error.message
            });
        }
    }
    
    console.log(`\r   Progress: ${iterations}/${iterations} ✓`);
    
    // Calculate statistics
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

function reportResults(testName, results) {
    console.log(`\n📊 ${testName} Results:`);
    console.log(`   ├─ Iterations: ${results.raw.length}`);
    console.log(`   ├─ Success Rate: ${results.stats.successRate}%`);
    console.log(`   │`);
    console.log(`   ├─ Gas Consumption:`);
    console.log(`   │  ├─ Mean: ${results.stats.gas.mean.toLocaleString()} gas`);
    console.log(`   │  ├─ Median: ${results.stats.gas.median.toLocaleString()} gas`);
    console.log(`   │  ├─ Std Dev: ${results.stats.gas.stdDev.toLocaleString()} gas`);
    console.log(`   │  ├─ Min: ${results.stats.gas.min.toLocaleString()} gas`);
    console.log(`   │  └─ Max: ${results.stats.gas.max.toLocaleString()} gas`);
    console.log(`   │`);
    console.log(`   └─ Latency:`);
    console.log(`      ├─ Mean: ${results.stats.latency.mean}ms`);
    console.log(`      ├─ Median: ${results.stats.latency.median}ms`);
    console.log(`      └─ Std Dev: ${results.stats.latency.stdDev}ms`);
}

benchmarkAllNonZK().catch(console.error);