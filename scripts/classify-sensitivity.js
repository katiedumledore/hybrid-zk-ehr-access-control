require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Sensitive condition keywords (based on HIPAA Part 2 sensitive categories)
const SENSITIVE_KEYWORDS = [
    // Mental Health
    'mental', 'psychiatric', 'depression', 'anxiety', 'bipolar', 'schizophrenia',
    'ptsd', 'post-traumatic', 'psychosis', 'suicide', 'self-harm',
    
    // Substance Abuse
    'substance', 'abuse', 'dependence', 'alcohol', 'drug', 'opioid', 'addiction',
    'withdrawal', 'intoxication', 'cocaine', 'heroin', 'methamphetamine',
    
    // HIV/AIDS
    'hiv', 'aids', 'human immunodeficiency',
    
    // Genetic Testing
    'genetic', 'genomic', 'hereditary', 'brca', 'chromosomal',
    
    // Reproductive Health
    'pregnancy', 'abortion', 'contraception', 'sexual dysfunction',
    
    // STDs
    'sexually transmitted', 'gonorrhea', 'syphilis', 'chlamydia', 'herpes'
];

async function classifySensitivity() {
    console.log("🔍 Classifying Patient Record Sensitivity\n");
    console.log("=".repeat(60));
    
    // Load parsed data
    const parsedPath = path.join(__dirname, '../synthea-parsed.json');
    if (!fs.existsSync(parsedPath)) {
        console.error("❌ synthea-parsed.json not found!");
        console.error("   Run parse-synthea-csv.js first");
        process.exit(1);
    }
    
    const patientRecords = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
    console.log(`✓ Loaded ${patientRecords.length} patient records\n`);
    
    console.log("1️⃣ Classifying by sensitivity...");
    
    const classified = patientRecords.map(patient => {
        const isSensitive = checkSensitivity(patient);
        
        return {
            ...patient,
            sensitivity: isSensitive ? 'SENSITIVE' : 'ROUTINE',
            sensitivityReason: isSensitive ? getSensitivityReason(patient) : 'No sensitive conditions detected'
        };
    });
    
    // Statistics
    const sensitiveCount = classified.filter(p => p.sensitivity === 'SENSITIVE').length;
    const routineCount = classified.filter(p => p.sensitivity === 'ROUTINE').length;
    
    console.log(`\n   ✓ Sensitive: ${sensitiveCount} patients`);
    console.log(`   ✓ Routine: ${routineCount} patients`);
    console.log(`   ✓ Ratio: ${((sensitiveCount/classified.length)*100).toFixed(1)}% sensitive`);
    
    // Show examples
    console.log("\n2️⃣ Sample Classifications:");
    console.log("=".repeat(60));
    
    const sensitiveSample = classified.find(p => p.sensitivity === 'SENSITIVE');
    if (sensitiveSample) {
        console.log("\n📕 Sensitive Patient:");
        console.log(`   ID: ${sensitiveSample.patientId.substring(0, 16)}...`);
        console.log(`   Reason: ${sensitiveSample.sensitivityReason}`);
    }
    
    const routineSample = classified.find(p => p.sensitivity === 'ROUTINE');
    if (routineSample) {
        console.log("\n📗 Routine Patient:");
        console.log(`   ID: ${routineSample.patientId.substring(0, 16)}...`);
        console.log(`   Reason: ${routineSample.sensitivityReason}`);
    }
    
    // Save classified data
    const outputPath = path.join(__dirname, '../synthea-classified.json');
    fs.writeFileSync(outputPath, JSON.stringify(classified, null, 2));
    
    console.log(`\n   ✓ Saved to: synthea-classified.json`);
    console.log("\n✅ Classification complete!");
    console.log("\n📝 Next: Encrypt and upload to IPFS");
}

function checkSensitivity(patient) {
    // Check all conditions for sensitive keywords
    for (const condition of patient.conditions) {
        const text = condition.description.toLowerCase();
        for (const keyword of SENSITIVE_KEYWORDS) {
            if (text.includes(keyword.toLowerCase())) {
                return true;
            }
        }
    }
    
    // Check medications (some medications indicate sensitive conditions)
    for (const med of patient.medications) {
        const text = med.description.toLowerCase();
        for (const keyword of SENSITIVE_KEYWORDS) {
            if (text.includes(keyword.toLowerCase())) {
                return true;
            }
        }
    }
    
    return false;
}

function getSensitivityReason(patient) {
    const reasons = [];
    
    // Check conditions
    for (const condition of patient.conditions) {
        const text = condition.description.toLowerCase();
        for (const keyword of SENSITIVE_KEYWORDS) {
            if (text.includes(keyword.toLowerCase())) {
                reasons.push(`Condition: ${condition.description}`);
                break;
            }
        }
    }
    
    return reasons.length > 0 ? reasons[0] : 'Sensitive data detected';
}

classifySensitivity().catch(console.error);