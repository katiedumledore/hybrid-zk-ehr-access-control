pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template ConsentVerificationV2() {
    signal input merkleRoot;        
    signal input patientId;         
    signal input nullifierHash;     
    signal input consentSecret;     
    signal input pathElements[4];   
    signal input pathIndices[4];    
    signal output isValid;
    
    // Declare ALL signals and components at template level
    component hasher = MiMCSponge(1, 220, 1);
    component hashers[4];
    component isEqual = IsEqual();
    component nullifier = MiMCSponge(2, 220, 1);
    component nullifierCheck = IsEqual();
    
    signal currentHash[5];
    signal left[4];
    signal right[4];
    signal aux1[4];
    signal aux2[4];
    signal aux3[4];
    signal aux4[4];
    signal aux5[4];
    signal temp;
    
    // Hash the consent secret to create leaf
    hasher.ins[0] <== consentSecret;
    hasher.k <== 0;
    currentHash[0] <== hasher.outs[0];
    
    // Merkle tree verification
    for (var i = 0; i < 4; i++) {
        aux1[i] <== 1 - pathIndices[i];
        aux2[i] <== aux1[i] * currentHash[i];
        aux3[i] <== pathIndices[i] * pathElements[i];
        left[i] <== aux2[i] + aux3[i];
        
        aux4[i] <== aux1[i] * pathElements[i];
        aux5[i] <== pathIndices[i] * currentHash[i];
        right[i] <== aux4[i] + aux5[i];
        
        hashers[i] = MiMCSponge(2, 220, 1);
        hashers[i].ins[0] <== left[i];
        hashers[i].ins[1] <== right[i];
        hashers[i].k <== 0;
        
        currentHash[i + 1] <== hashers[i].outs[0];
    }
    
    // Check if computed root matches
    isEqual.in[0] <== currentHash[4];
    isEqual.in[1] <== merkleRoot;
    
    // Generate and check nullifier
    nullifier.ins[0] <== consentSecret;
    nullifier.ins[1] <== patientId;
    nullifier.k <== 0;
    
    nullifierCheck.in[0] <== nullifier.outs[0];
    nullifierCheck.in[1] <== nullifierHash;
    
    // Output
    temp <== isEqual.out * nullifierCheck.out;
    isValid <== temp;
}

component main = ConsentVerificationV2();