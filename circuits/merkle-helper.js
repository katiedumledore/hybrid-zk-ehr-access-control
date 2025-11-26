const circomlibjs = require("circomlibjs");
const { ethers } = require("hardhat");

/**
 * 4-level Merkle Tree using MiMCSponge (matches circuit)
 * Supports up to 16 patients
 */
class ConsentMerkleTree {
    constructor(mimcsponge) {
        this.mimcsponge = mimcsponge;
        this.F = mimcsponge.F;
        this.leaves = [];
        this.levels = [];
        this.treeDepth = 4; // Fixed at 4 to match circuit
    }
    
    /**
     * Hash function matching circuit's MiMCSponge(2, 220, 1)
     */
    hash(left, right) {
        const result = this.mimcsponge.multiHash([
            this.F.e(left),
            this.F.e(right)
        ], this.F.e(0), 1);
        return this.F.toString(result);
    }
    
    /**
     * Hash single value (for leaf generation)
     */
    hashOne(value) {
        const result = this.mimcsponge.multiHash([
            this.F.e(value)
        ], this.F.e(0), 1);
        return this.F.toString(result);
    }
    
    /**
     * Build tree from consent secrets
     */
    buildTree(consentSecrets) {
        console.log(`\n🌳 Building ${this.treeDepth}-level Merkle tree with ${consentSecrets.length} leaves...`);
        
        // Level 0: Hash each consent secret to create leaves
        this.leaves = consentSecrets.map(secret => this.hashOne(secret));
        
        // Pad to 16 leaves (2^4)
        const targetSize = 16;
        console.log(`   Padding to ${targetSize} leaves...`);
        
        while (this.leaves.length < targetSize) {
            this.leaves.push(this.hashOne(0));
        }
        
        this.levels[0] = this.leaves;
        console.log(`   Level 0 (leaves): ${this.leaves.length} nodes`);
        
        // Build upper levels
        for (let level = 1; level <= this.treeDepth; level++) {
            const previousLevel = this.levels[level - 1];
            const currentLevel = [];
            
            // Process in pairs
            for (let i = 0; i < previousLevel.length; i += 2) {
                const left = previousLevel[i];
                const right = previousLevel[i + 1];
                
                const parent = this.hash(left, right);
                currentLevel.push(parent);
            }
            
            this.levels[level] = currentLevel;
            console.log(`   Level ${level}: ${currentLevel.length} nodes`);
        }
        
        const root = this.levels[this.treeDepth][0];
        console.log(`   ✓ Root: ${root.substring(0, 20)}...`);
        
        return root;
    }
    
    /**
     * Get Merkle proof for a leaf at given index
     */
    getProof(leafIndex) {
        if (leafIndex >= this.leaves.length) {
            throw new Error(`Index ${leafIndex} out of bounds`);
        }
        
        const pathElements = [];
        const pathIndices = [];
        
        let currentIndex = leafIndex;
        
        for (let level = 0; level < this.treeDepth; level++) {
            const isRightNode = currentIndex % 2 === 1;
            const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
            
            pathElements.push(this.levels[level][siblingIndex]);
            pathIndices.push(isRightNode ? 1 : 0);
            
            currentIndex = Math.floor(currentIndex / 2);
        }
        
        return {
            pathElements,
            pathIndices,
            leaf: this.leaves[leafIndex]
        };
    }
    
    /**
     * Verify a proof
     */
    verifyProof(leaf, pathElements, pathIndices, root) {
        let currentHash = leaf;
        
        for (let i = 0; i < pathElements.length; i++) {
            const sibling = pathElements[i];
            const isRight = pathIndices[i] === 1;
            
            currentHash = isRight
                ? this.hash(sibling, currentHash)
                : this.hash(currentHash, sibling);
        }
        
        return currentHash === root;
    }
}

/**
 * Calculate nullifier hash (matches circuit's MiMCSponge(2, 220, 1))
 */
function calculateNullifier(mimcsponge, consentSecret, patientId) {
    const F = mimcsponge.F;
    
    // Convert patientId string to field element
    const patientIdHash = ethers.toBigInt(ethers.id(patientId));
    const patientIdField = patientIdHash % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    
    const result = mimcsponge.multiHash([
        F.e(consentSecret),
        F.e(patientIdField.toString())
    ], F.e(0), 1);
    
    return F.toString(result);
}

/**
 * Initialize and build consent tree for all patients
 */
async function buildConsentTree(patients) {
    console.log("🔐 Initializing MiMCSponge hash function...");
    const mimcsponge = await circomlibjs.buildMimcSponge();
    console.log("   ✓ MiMCSponge ready");
    
    const tree = new ConsentMerkleTree(mimcsponge);
    
    // Use patient IDs as consent secrets (simplified for testing)
    const consentSecrets = patients.map(p => {
        const hash = ethers.id(p.patientId);
        const bigInt = ethers.toBigInt(hash);
        // Take mod to fit in field
        const fieldElement = bigInt % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        return fieldElement.toString();
    });
    
    const root = tree.buildTree(consentSecrets);
    
    return {
        tree,
        mimcsponge,
        consentSecrets,
        root
    };
}

module.exports = {
    ConsentMerkleTree,
    calculateNullifier,
    buildConsentTree
};