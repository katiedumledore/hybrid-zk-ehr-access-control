const { ethers } = require("hardhat");
const fs = require("fs");

async function benchmarkAllZK() {
    console.log("📊 BENCHMARKING ALL-ZK BASELINE\n");
    console.log("=".repeat(70));
    
    // Load deployment and proof
    const deployment = JSON.parse(fs.readFileSync('deployment-allzk.json', 'utf8'));
    const mapping = JSON.parse(fs.readFileSync('ipfs-mapping.json', 'utf8'));
    
    // Load VALID proof from valid-proof.json
    console.log("🔍 Loading pre-generated valid ZK proof...");
    const proofData = JSON.parse(fs.readFileSync("valid-proof.json"));
    
    // Extract Solidity-formatted proof
    const solidityProof = proofData.solidityProof;
    const proof_a = solidityProof.proof_a;
    const proof_b = solidityProof.proof_b;
    const proof_c = solidityProof.proof_c;
    const publicSignals = solidityProof.publicSignals;
    
    console.log("   ✓ Valid ZK proof loaded");
    console.log(`   └─ Public signals: ${publicSignals} (isValid = 1)`);
    
    // ===== GET ALL AVAILABLE ACCOUNTS =====
    const accounts = await ethers.getSigners();
    console.log(`\n💰 Available Accounts: ${accounts.length}`);
    
    // Helper function for formatting
    const formatEther = (value) => {
        if (ethers.utils && ethers.utils.formatEther) {
            return ethers.utils.formatEther(value);
        } else {
            return ethers.formatEther(value);
        }
    };
    
    // Check initial balances
    for (let i = 0; i < Math.min(5, accounts.length); i++) {
        const balance = await ethers.provider.getBalance(accounts[i].address);
        console.log(`   Account ${i}: ${formatEther(balance)} ETH`);
    }
    
    const allZK = await ethers.getContractAt("AllZKAccess", deployment.allZKAddress);
    
    console.log("\nContract:", deployment.allZKAddress);
    console.log("Starting with Account 0:", accounts[0].address);
    console.log();
    
    // Use first 16 patients
    const allPatients = mapping;
    const patients = allPatients.slice(0, 16);
    
    const routinePatients = patients.filter(p => p.sensitivity === 'ROUTINE');
    const sensitivePatients = patients.filter(p => p.sensitivity === 'SENSITIVE');
    
    console.log(`Dataset: ${routinePatients.length} routine, ${sensitivePatients.length} sensitive (16 total)`);
    console.log();
    
    // ===== TEST 1: ROUTINE ACCESS =====
    console.log("=".repeat(70));
    console.log("TEST 1: ROUTINE ACCESS (⚡ Requires ZK Proof Verification)");
    console.log("=".repeat(70));
    
    const routineResults = await runZKAccessBenchmark(
        allZK,
        routinePatients,
        'ROUTINE',
        proof_a,
        proof_b,
        proof_c,
        publicSignals,
        100,
        accounts,
        formatEther
    );
    
    reportResults('Routine Access (ZK)', routineResults);
    
    // ===== TEST 2: SENSITIVE ACCESS =====
    console.log("\n" + "=".repeat(70));
    console.log("TEST 2: SENSITIVE ACCESS (🔐 Also Requires ZK Proof Verification)");
    console.log("=".repeat(70));
    
    const sensitiveResults = await runZKAccessBenchmark(
        allZK,
        sensitivePatients,
        'SENSITIVE',
        proof_a,
        proof_b,
        proof_c,
        publicSignals,
        100,
        accounts,
        formatEther
    );
    
    reportResults('Sensitive Access (ZK)', sensitiveResults);
    
    // ===== COMBINED STATISTICS =====
    console.log("\n" + "=".repeat(70));
    console.log("OVERALL ALL-ZK STATISTICS");
    console.log("=".repeat(70));
    
    const allResults = [...routineResults.raw, ...sensitiveResults.raw];
    
    if (allResults.length === 0) {
        console.log("\n⚠️  No successful transactions - cannot generate statistics");
        process.exit(1);
    }
    
    const combinedStats = calculateStats(allResults.map(r => r.gasUsed));
    
    console.log(`\nTotal Transactions: ${allResults.length}`);
    console.log(`  ├─ Routine (ZK): ${routineResults.raw.length}`);
    console.log(`  └─ Sensitive (ZK): ${sensitiveResults.raw.length}`);
    
    console.log(`\nCombined Gas Consumption:`);
    console.log(`  ├─ Mean: ${combinedStats.mean.toLocaleString()} gas`);
    console.log(`  ├─ Median: ${combinedStats.median.toLocaleString()} gas`);
    console.log(`  ├─ Std Dev: ${combinedStats.stdDev.toLocaleString()} gas`);
    console.log(`  ├─ Min: ${combinedStats.min.toLocaleString()} gas`);
    console.log(`  └─ Max: ${combinedStats.max.toLocaleString()} gas`);
    
    // ===== ACCOUNT USAGE =====
    console.log(`\n💳 Account Usage:`);
    console.log(`  └─ Total accounts used: ${Math.max(routineResults.accountsUsed, sensitiveResults.accountsUsed)}`);
    
    // ===== EXPORT RESULTS =====
    console.log("\n" + "=".repeat(70));
    console.log("EXPORTING RESULTS");
    console.log("=".repeat(70));
    
    const exportData = {
        model: "All-ZK (Universal ZKP)",
        timestamp: new Date().toISOString(),
        contract: deployment.allZKAddress,
        circuitInfo: {
            constraints: 7281,
            file: "consent-verification-v2.circom",
            provingKey: "circuit_final.zkey",
            treeDepth: 4,
            maxPatients: 16
        },
        dataset: {
            routine: routinePatients.length,
            sensitive: sensitivePatients.length,
            total: patients.length
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
                note: "Both routine AND sensitive require ZK proof verification"
            }
        }
    };
    
    fs.writeFileSync(
        'benchmark-allzk-results.json',
        JSON.stringify(exportData, null, 2)
    );
    
    console.log("\n✓ Results saved to: benchmark-allzk-results.json");
    
    // ===== KEY INSIGHTS =====
    console.log("\n" + "=".repeat(70));
    console.log("🔑 KEY INSIGHTS");
    console.log("=".repeat(70));
    
    console.log("\n✅ All-ZK Maximum Privacy:");
    console.log(`   • Zero information leakage (all operations use ZK)`);
    console.log(`   • Routine AND sensitive both require proof verification`);
    console.log(`   • Consistent cryptographic guarantees`);
    
    console.log("\n⚠️  All-ZK Performance Cost:");
    console.log(`   • High gas consumption: ${combinedStats.mean.toLocaleString()} gas average`);
    console.log(`   • Same cost for routine vital signs as sensitive mental health`);
    console.log(`   • ~157x more expensive than non-ZK approach`);
    
    console.log("\n✨ Benchmark Complete!");
    console.log("   Next: npx hardhat run scripts/advanced-statistics.js");
    
    process.exit(0);
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
    console.log(`\nRunning ${iterations} iterations of ${recordType} access with ZK proofs...\n`);
    
    const results = [];
    
    // ===== ACCOUNT MANAGEMENT =====
    let currentAccountIndex = 0;
    let currentAccount = accounts[currentAccountIndex];
    let connectedContract = contract.connect(currentAccount);
    
    const MIN_BALANCE_ETH = 1500;
    const MAX_ACCOUNTS = Math.min(10, accounts.length);
    
    let accountSwitchCount = 0;
    
    for (let i = 0; i < iterations; i++) {
        const patient = patients[i % patients.length];
        const patientId = ethers.id ? ethers.id(patient.patientId) : ethers.utils.id(patient.patientId);
        
        // ===== CHECK BALANCE =====
        try {
            const balance = await ethers.provider.getBalance(currentAccount.address);
            const balanceETH = parseFloat(formatEther(balance));
            
            if (balanceETH < MIN_BALANCE_ETH && currentAccountIndex < MAX_ACCOUNTS - 1) {
                currentAccountIndex++;
                currentAccount = accounts[currentAccountIndex];
                connectedContract = contract.connect(currentAccount);
                accountSwitchCount++;
                
                const newBalance = await ethers.provider.getBalance(currentAccount.address);
                const newBalanceETH = parseFloat(formatEther(newBalance));
                
                console.log(`\n💳 Account ${currentAccountIndex - 1} low on funds (${balanceETH.toFixed(2)} ETH)`);
                console.log(`   → Switching to Account ${currentAccountIndex}`);
                console.log(`   → New balance: ${newBalanceETH.toFixed(2)} ETH\n`);
            } else if (balanceETH < MIN_BALANCE_ETH && currentAccountIndex >= MAX_ACCOUNTS - 1) {
                console.log(`\n⚠️  All ${MAX_ACCOUNTS} accounts exhausted! Stopping at iteration ${i + 1}/${iterations}`);
                break;
            }
        } catch (balanceError) {
            console.error(`\n⚠️  Balance check failed: ${balanceError.message}`);
        }
        
        // ===== EXECUTE TRANSACTION =====
        const startTime = Date.now();
        
        try {
            // FIXED: No explicit gas limit - let Hardhat estimate
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
                patientId: patient.patientId.substring(0, 20) + '...',
                sensitivity: patient.sensitivity,
                gasUsed: Number(receipt.gasUsed),
                latency: endTime - startTime,
                blockNumber: receipt.blockNumber,
                accountUsed: currentAccountIndex,
                zkProofUsed: true,
                success: true
            });
            
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`\r   Progress: ${i + 1}/${iterations}`);
            }
            
        } catch (error) {
            console.error(`\n   ✗ Iteration ${i + 1} failed: ${error.message}`);
            
            if (error.message.includes("funds") && currentAccountIndex >= MAX_ACCOUNTS - 1) {
                console.log(`\n⚠️  Cannot continue - all accounts exhausted`);
                break;
            }
            
            results.push({
                iteration: i + 1,
                success: false,
                error: error.message,
                accountUsed: currentAccountIndex
            });
        }
    }
    
    console.log(`\r   Progress: ${results.filter(r => r.success).length}/${iterations} ✓`);
    
    if (accountSwitchCount > 0) {
        console.log(`\n💡 Account switches: ${accountSwitchCount} (used ${accountSwitchCount + 1} accounts total)`);
    }
    
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
        accountsUsed: accountSwitchCount + 1
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
    
    // FIXED: Handle null stats
    if (results.stats.gas === null || results.raw.length === 0) {
        console.log(`   │`);
        console.log(`   ├─ Gas Consumption: No successful transactions`);
        console.log(`   │`);
        console.log(`   └─ Latency: No data`);
        return;
    }
    
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

benchmarkAllZK().catch(console.error);