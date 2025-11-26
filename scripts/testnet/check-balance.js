const { ethers } = require("hardhat");

/**
 * Check Sepolia ETH balance and estimate remaining capacity
 */

async function checkBalance() {
    console.log("💰 Sepolia Balance Checker\n");
    console.log("=".repeat(60));
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name);
    console.log("Chain ID:", network.chainId);
    
    if (network.chainId !== 11155111n) {
        console.warn("⚠️  Not connected to Sepolia testnet");
    }
    
    const [signer] = await ethers.getSigners();
    const address = signer.address;
    const balance = await ethers.provider.getBalance(address);
    const balanceEth = ethers.formatEther(balance);
    
    console.log("\n📊 Account Information:");
    console.log("   Address:", address);
    console.log("   Balance:", balanceEth, "ETH");
    
    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    const gasPriceGwei = ethers.formatUnits(gasPrice, "gwei");
    
    console.log("   Gas Price:", gasPriceGwei, "gwei");
    
    // Estimate costs
    console.log("\n💸 Estimated Costs:");
    
    const estimates = {
        deployment: {
            gas: 3 * 2500000, // 3 contracts × 2.5M gas
            label: "Deployment (3 contracts)"
        },
        storage: {
            gas: 3 * 16 * 120000, // 3 models × 16 patients × 120k gas
            label: "Patient storage (48 records)"
        },
        benchmark_5: {
            gas: 5 * 16 * 3 * 200000, // 5 iter × 16 patients × 3 models × avg 200k gas
            label: "Benchmarking (5 iterations)"
        },
        benchmark_10: {
            gas: 10 * 16 * 3 * 200000,
            label: "Benchmarking (10 iterations)"
        },
        benchmark_20: {
            gas: 20 * 16 * 3 * 200000,
            label: "Benchmarking (20 iterations)"
        }
    };
    
    for (const [key, estimate] of Object.entries(estimates)) {
        const cost = BigInt(estimate.gas) * gasPrice;
        const costEth = ethers.formatEther(cost);
        console.log(`   ${estimate.label}: ${costEth} ETH (${estimate.gas.toLocaleString()} gas)`);
    }
    
    // Calculate total for complete workflow
    const totalGas = 
        estimates.deployment.gas + 
        estimates.storage.gas + 
        estimates.benchmark_10.gas;
    
    const totalCost = BigInt(totalGas) * gasPrice;
    const totalCostEth = ethers.formatEther(totalCost);
    
    console.log("\n📊 Complete Workflow (Deploy + 10 iter):");
    console.log(`   Total gas: ${totalGas.toLocaleString()}`);
    console.log(`   Total cost: ${totalCostEth} ETH`);
    
    // Check if balance is sufficient
    const balanceBigInt = balance;
    const sufficient = balanceBigInt >= totalCost;
    
    console.log("\n" + "=".repeat(60));
    if (sufficient) {
        console.log("✅ BALANCE SUFFICIENT");
        const remaining = balanceBigInt - totalCost;
        const remainingEth = ethers.formatEther(remaining);
        console.log(`   Estimated remaining: ${remainingEth} ETH`);
        
        // Calculate max iterations possible
        const maxIterGas = estimates.benchmark_10.gas / 10; // Gas per iteration
        const remainingForBench = remaining - BigInt(estimates.deployment.gas + estimates.storage.gas) * gasPrice;
        const maxIter = Number(remainingForBench / (BigInt(maxIterGas) * gasPrice));
        
        console.log(`   Max possible iterations: ~${Math.floor(maxIter)}`);
    } else {
        console.log("⚠️  BALANCE MAY BE INSUFFICIENT");
        const shortfall = totalCost - balanceBigInt;
        const shortfallEth = ethers.formatEther(shortfall);
        console.log(`   Shortfall: ${shortfallEth} ETH`);
        console.log("\n   Get more Sepolia ETH from:");
        console.log("   • https://sepoliafaucet.com/");
        console.log("   • https://www.alchemy.com/faucets/ethereum-sepolia");
        console.log("   • https://faucet.quicknode.com/ethereum/sepolia");
    }
    console.log("=".repeat(60));
    
    // Recommendations
    console.log("\n💡 Recommendations:");
    
    const balanceNum = parseFloat(balanceEth);
    
    if (balanceNum < 0.5) {
        console.log("   ⚠️  Get more ETH before deploying");
    } else if (balanceNum < 1.0) {
        console.log("   ✅ Sufficient for deployment + 5-10 iterations");
        console.log("   ⚠️  Consider getting more for extended testing");
    } else if (balanceNum < 1.5) {
        console.log("   ✅ Good balance for deployment + 10-15 iterations");
    } else {
        console.log("   ✅ Excellent balance for deployment + 20+ iterations");
    }
    
    console.log("\n📝 Notes:");
    console.log("   • Gas prices fluctuate; actual costs may vary");
    console.log("   • Keep ~0.2 ETH buffer for safety");
    console.log("   • Failed transactions still consume gas");
    
    return {
        address,
        balance: balanceEth,
        gasPrice: gasPriceGwei,
        sufficient,
        estimates
    };
}

// Execute if run directly
if (require.main === module) {
    checkBalance()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("\n❌ Error:", error);
            process.exit(1);
        });
}

module.exports = checkBalance;
