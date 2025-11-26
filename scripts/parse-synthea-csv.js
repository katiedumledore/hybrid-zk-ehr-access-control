require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const pinataSDK = require('@pinata/sdk');

// Initialize Pinata
const pinata = new pinataSDK({
    pinataApiKey: process.env.PINATA_API_KEY,
    pinataSecretApiKey: process.env.PINATA_API_SECRET
});

// Sensitivity classification logic
function classifySensitivity(conditions) {
    const sensitiveKeywords = [
        'mental', 'psychiatric', 'depression', 'anxiety', 'bipolar', 'schizophrenia',
        'substance', 'abuse', 'addiction', 'alcohol', 'drug',
        'hiv', 'aids', 'sexually transmitted',
        'genetic', 'hereditary',
        'reproductive', 'pregnancy', 'abortion',
        'suicide', 'self-harm'
    ];
    
    for (const condition of conditions) {
        const conditionText = condition.DESCRIPTION.toLowerCase();
        for (const keyword of sensitiveKeywords) {
            if (conditionText.includes(keyword)) {
                return 'SENSITIVE';
            }
        }
    }
    
    return 'ROUTINE';
}

// Parse CSV file
function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        Papa.parse(fileContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
        });
    });
}

async function processSyntheaData() {
    console.log("📊 Processing Synthea CSV Dataset\n");
    console.log("=".repeat(70));
    
    const dataDir = path.join(__dirname, '../synthea-data');
    
    // Check if directory exists
    if (!fs.existsSync(dataDir)) {
        console.error("❌ synthea-data folder not found!");
        console.error("   Expected location:", dataDir);
        process.exit(1);
    }
    
    try {
        // Step 1: Load all CSV files
        console.log("\n1️⃣ Loading CSV files...");
        
        const patients = await parseCSV(path.join(dataDir, 'patients.csv'));
        console.log(`   ✓ Loaded ${patients.length} patients`);
        
        const conditions = await parseCSV(path.join(dataDir, 'conditions.csv'));
        console.log(`   ✓ Loaded ${conditions.length} conditions`);
        
        const medications = await parseCSV(path.join(dataDir, 'medications.csv'));
        console.log(`   ✓ Loaded ${medications.length} medications`);
        
        const observations = await parseCSV(path.join(dataDir, 'observations.csv'));
        console.log(`   ✓ Loaded ${observations.length} observations`);
        
        // Step 2: Process patients (limit to first 20 for testing)
        console.log("\n2️⃣ Processing patient records...");
        const processedRecords = [];
        const maxPatients = Math.min(20, patients.length);
        
        for (let i = 0; i < maxPatients; i++) {
            const patient = patients[i];
            const patientId = patient.Id;
            
            // Get patient's conditions
            const patientConditions = conditions.filter(c => c.PATIENT === patientId);
            
            // Get patient's medications
            const patientMedications = medications.filter(m => m.PATIENT === patientId);
            
            // Get recent observations (last 5)
            const patientObservations = observations
                .filter(o => o.PATIENT === patientId)
                .slice(-5);
            
            // Classify sensitivity
            const sensitivity = classifySensitivity(patientConditions);
            
            // Create patient record
            const patientRecord = {
                patientId: patientId,
                demographics: {
                    firstName: patient.FIRST,
                    lastName: patient.LAST,
                    birthDate: patient.BIRTHDATE,
                    gender: patient.GENDER,
                    race: patient.RACE,
                    ethnicity: patient.ETHNICITY,
                    city: patient.CITY,
                    state: patient.STATE
                },
                conditions: patientConditions.map(c => ({
                    code: c.CODE,
                    description: c.DESCRIPTION,
                    onsetDate: c.START
                })).slice(0, 10), // Limit to 10 conditions
                medications: patientMedications.map(m => ({
                    code: m.CODE,
                    description: m.DESCRIPTION,
                    startDate: m.START
                })).slice(0, 10), // Limit to 10 medications
                observations: patientObservations.map(o => ({
                    code: o.CODE,
                    description: o.DESCRIPTION,
                    value: o.VALUE,
                    units: o.UNITS,
                    date: o.DATE
                })),
                sensitivity: sensitivity,
                processedDate: new Date().toISOString()
            };
            
            // Simple encryption (base64 encoding for demo)
            const encryptedRecord = {
                encrypted: true,
                algorithm: 'base64-demo', // In production, use AES-256
                data: Buffer.from(JSON.stringify(patientRecord)).toString('base64'),
                metadata: {
                    patientId: patientId,
                    sensitivity: sensitivity,
                    recordType: 'ehr-synthea'
                }
            };
            
            // Upload to IPFS
            console.log(`\n   Processing Patient ${i + 1}/${maxPatients}: ${patient.FIRST} ${patient.LAST}`);
            console.log(`   ├─ Conditions: ${patientConditions.length}`);
            console.log(`   ├─ Medications: ${patientMedications.length}`);
            console.log(`   ├─ Observations: ${patientObservations.length}`);
            console.log(`   └─ Sensitivity: ${sensitivity}`);
            
            try {
                const ipfsResult = await pinata.pinJSONToIPFS(encryptedRecord, {
                    pinataMetadata: {
                        name: `patient-${patientId}`,
                        keyvalues: {
                            sensitivity: sensitivity,
                            patientId: patientId,
                            type: 'ehr-record'
                        }
                    }
                });
                
                console.log(`   ✓ Uploaded to IPFS: ${ipfsResult.IpfsHash}`);
                
                // Calculate record hash (for smart contract verification)
                const crypto = require('crypto');
                const recordHash = '0x' + crypto
                    .createHash('sha256')
                    .update(JSON.stringify(patientRecord))
                    .digest('hex');
                
                processedRecords.push({
                    patientId: patientId,
                    patientName: `${patient.FIRST} ${patient.LAST}`,
                    ipfsCID: ipfsResult.IpfsHash,
                    sensitivity: sensitivity,
                    recordHash: recordHash,
                    conditionCount: patientConditions.length,
                    medicationCount: patientMedications.length,
                    uploadedAt: new Date().toISOString()
                });
                
            } catch (error) {
                console.error(`   ✗ Upload failed: ${error.message}`);
            }
        }
        
        // Step 3: Save mapping file
        console.log("\n3️⃣ Saving IPFS mapping...");
        const mappingPath = path.join(__dirname, '../ipfs-mapping.json');
        fs.writeFileSync(mappingPath, JSON.stringify(processedRecords, null, 2));
        console.log(`   ✓ Saved to: ${mappingPath}`);
        
        // Step 4: Generate summary
        console.log("\n" + "=".repeat(70));
        console.log("📊 PROCESSING COMPLETE");
        console.log("=".repeat(70));
        
        const routineCount = processedRecords.filter(r => r.sensitivity === 'ROUTINE').length;
        const sensitiveCount = processedRecords.filter(r => r.sensitivity === 'SENSITIVE').length;
        
        console.log(`\n✅ Successfully processed ${processedRecords.length} patient records`);
        console.log(`   ├─ Routine: ${routineCount} (${(routineCount/processedRecords.length*100).toFixed(1)}%)`);
        console.log(`   └─ Sensitive: ${sensitiveCount} (${(sensitiveCount/processedRecords.length*100).toFixed(1)}%)`);
        
        console.log("\n📁 Files created:");
        console.log("   └─ ipfs-mapping.json (patient → IPFS CID mapping)");
        
        console.log("\n🔗 View on Pinata:");
        console.log("   Dashboard: https://app.pinata.cloud/pinmanager");
        
        console.log("\n📋 Sample records:");
        processedRecords.slice(0, 3).forEach((record, idx) => {
            console.log(`\n   ${idx + 1}. ${record.patientName} (${record.sensitivity})`);
            console.log(`      IPFS CID: ${record.ipfsCID}`);
            console.log(`      Gateway: https://gateway.pinata.cloud/ipfs/${record.ipfsCID}`);
            console.log(`      Conditions: ${record.conditionCount}, Medications: ${record.medicationCount}`);
        });
        
        console.log("\n✨ Next steps:");
        console.log("   1. Verify uploads on Pinata dashboard");
        console.log("   2. Update smart contracts to store IPFS CIDs");
        console.log("   3. Run privacy verification script");
        
    } catch (error) {
        console.error("\n❌ Processing failed!");
        console.error("Error:", error.message);
        console.error("\nStack trace:", error.stack);
        process.exit(1);
    }
}

processSyntheaData().catch(console.error);