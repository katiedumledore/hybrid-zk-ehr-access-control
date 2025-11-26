const checkBalance = require('./check-balance');
const deployAllNonZK = require('./deploy-allnonzk-testnet');
const deployHybrid = require('./deploy-hybrid-testnet');
const deployAllZK = require('./deploy-allzk-testnet');

/**
 * Master Deployment Script
 * Deploys all three models sequentially with balance checks
 */

async function masterDeploy() {
    console.log("🚀 MASTER DEPLOYMENT - ALL THREE MODELS\n");
    console.log("=".repeat(70));
    console.log("This will deploy:");
    console.log("  1. AllNonZK (Pure RBAC)");
    console.log("  2. Hybrid (Smart Routing)");
    console.log("  3. AllZK (Universal ZK)");
    console.log("=".repeat(70));
    
    // Initial balance check
    console.log("\n📊 Step 0: Checking balance...");
    const balanceCheck = await checkBalance();
    
    if (!balanceCheck.sufficient) {
        console.error("\n❌ Insufficient balance for complete deployment!");
        console.error("   Please get more Sepolia ETH before continuing.");
        process.exit(1);
    }
    
    console.log("\n✅ Balance sufficient. Proceeding with deployment...");
    await delay(3000); // 3 second pause
    
    const results = {
        timestamp: new Date().toISOString(),
        deployments: {}
    };
    
    // Deploy Model 1: AllNonZK
    try {
        console.log("\n" + "=".repeat(70));
        console.log("DEPLOYING MODEL 1/3: AllNonZK");
        console.log("=".repeat(70));
        
        results.deployments.allNonZK = await deployAllNonZK();
        
        console.log("\n✅ AllNonZK deployed successfully");
        console.log("   Waiting 10 seconds before next deployment...");
        await delay(10000);
        
    } catch (error) {
        console.error("\n❌ AllNonZK deployment failed:", error.message);
        results.deployments.allNonZK = { error: error.message, status: "failed" };
    }
    
    // Deploy Model 2: Hybrid
    try {
        console.log("\n" + "=".repeat(70));
        console.log("DEPLOYING MODEL 2/3: Hybrid");
        console.log("=".repeat(70));
        
        results.deployments.hybrid = await deployHybrid();
        
        console.log("\n✅ Hybrid deployed successfully");
        console.log("   Waiting 10 seconds before next deployment...");
        await delay(10000);
        
    } catch (error) {
        console.error("\n❌ Hybrid deployment failed:", error.message);
        results.deployments.hybrid = { error: error.message, status: "failed" };
    }
    
    // Deploy Model 3: AllZK
    try {
        console.log("\n" + "=".repeat(70));
        console.log("DEPLOYING MODEL 3/3: AllZK");
        console.log("=".repeat(70));
        
        results.deployments.allZK = await deployAllZK();
        
        console.log("\n✅ AllZK deployed successfully");
        
    } catch (error) {
        console.error("\n❌ AllZK deployment failed:", error.message);
        results.deployments.allZK = { error: error.message, status: "failed" };
    }
    
    // Final summary
    console.log("\n" + "=".repeat(70));
    console.log("DEPLOYMENT SUMMARY");
    console.log("=".repeat(70));
    
    const deployed = Object.values(results.deployments).filter(d => d && !d.error).length;
    const failed = Object.values(results.deployments).filter(d => d && d.error).length;
    
    console.log(`\n✅ Deployed: ${deployed}/3 models`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed}/3 models`);
    }
    
    if (results.deployments.allNonZK && !results.deployments.allNonZK.error) {
        console.log(`\n📍 AllNonZK: ${results.deployments.allNonZK.contract}`);
        console.log(`   ${results.deployments.allNonZK.etherscanUrl}`);
    }
    
    if (results.deployments.hybrid && !results.deployments.hybrid.error) {
        console.log(`\n📍 Hybrid: ${results.deployments.hybrid.hybridAddress}`);
        console.log(`   ${results.deployments.hybrid.etherscanUrls.hybrid}`);
    }
    
    if (results.deployments.allZK && !results.deployments.allZK.error) {
        console.log(`\n📍 AllZK: ${results.deployments.allZK.allZKAddress}`);
        console.log(`   ${results.deployments.allZK.etherscanUrls.allZK}`);
    }
    
    // Final balance check
    console.log("\n📊 Final Balance Check:");
    const finalBalance = await checkBalance();
    console.log(`   Remaining: ${finalBalance.balance} ETH`);
    
    if (deployed === 3) {
        console.log("\n" + "=".repeat(70));
        console.log("🎉 ALL DEPLOYMENTS COMPLETE!");
        console.log("=".repeat(70));
        console.log("\n🔬 Next Steps:");
        console.log("   1. Verify contracts on Etherscan (optional)");
        console.log("   2. Run benchmarking:");
        console.log("      npx hardhat run scripts/testnet/benchmark-testnet.js --network sepolia");
        console.log("\n💡 Recommended: Start with 10 iterations");
    } else {
        console.log("\n⚠️  Some deployments failed. Check errors above.");
    }
    
    return results;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute if run directly
if (require.main === module) {
    masterDeploy()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("\n❌ Master deployment failed:", error);
            process.exit(1);
        });
}

module.exports = masterDeploy;
