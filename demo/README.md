# Hybrid EHR Demo - Interactive Web Interface

Live demonstration of hybrid zero-knowledge proof system for EHR access control.

## 🎯 Overview

This interactive web application connects to deployed smart contracts on Ethereum Sepolia testnet, allowing real-time demonstration of:

- **Routine Access** via RBAC (AllNonZK contract) - ~183K gas
- **Sensitive Access** via Zero-Knowledge Proofs (HybridV4 contract) - ~16M gas
- **Real-time Analytics** showing gas differentials, privacy metrics, and cost analysis

## 📋 Requirements

### Software
- Modern web browser (Chrome, Firefox, Edge)
- MetaMask browser extension

### Blockchain
- MetaMask configured for **Sepolia Testnet**
- Small amount of Sepolia ETH (~0.01 ETH recommended)
  - Get free testnet ETH: https://sepoliafaucet.com/

### Files Required
```
demo/
├── hybrid-ehr-demo.html    ← Main demo file
└── valid-proof.json        ← ZK proof (for sensitive operations)
```

## 🚀 Quick Start

### Step 1: Get Testnet ETH

```
1. Visit https://sepoliafaucet.com/
2. Enter your wallet address
3. Receive 0.5 Sepolia ETH
```

### Step 2: Setup Demo Files

```bash
# Ensure you're in the demo folder
cd demo

# Verify files exist
ls -la
# Should see:
#   hybrid-ehr-demo.html
#   valid-proof.json
```

### Step 3: Open Demo

**Method 1: Direct Open**
```bash
# Double-click hybrid-ehr-demo.html
# OR
open hybrid-ehr-demo.html   # macOS
start hybrid-ehr-demo.html  # Windows
```

**Method 2: Local Server (recommended)**
```bash
# Python 3
python -m http.server 8000

# Then open: http://localhost:8000/hybrid-ehr-demo.html
```

### Step 4: Connect MetaMask

1. Click **"Connect MetaMask"** button
2. Approve connection in MetaMask popup
3. Ensure you're on **Sepolia Testnet**
4. See green "Sepolia Testnet" badge appear

---

## 📖 Usage Guide

### Making Routine Access Requests

**Use Case:** Accessing non-sensitive health data (vital signs, medications, allergies)

1. **Select Patient** with `[ROUTINE]` label
   - Example: "Caryl47 Cassin499 [ROUTINE]"

2. **Click Data Type** (green buttons):
   - 💓 Vital Signs
   - 💊 Medications
   - 🧪 Lab Results
   - ⚠️ Allergies

3. **Click "Request Access"**
   - MetaMask popup appears
   - Gas estimate: ~183,000
   - Cost: ~$0.03 USD

4. **Approve Transaction**
   - Wait 5-15 seconds
   - Transaction appears in history
   - Stats update automatically

**Contract Used:** AllNonZK (`0x2847...7e1`)

### Making Sensitive Access Requests

**Use Case:** Accessing HIPAA-protected sensitive data (mental health, genetic testing)

⚠️ **Requires `valid-proof.json` in same folder!**

1. **Select Patient** with `[SENSITIVE]` label
   - Example: "Britt177 Keeling57 [SENSITIVE]"

2. **Click Data Type** (yellow buttons):
   - 🧠 Mental Health
   - 🧬 Genetic Testing
   - 🔒 HIV Status
   - 🚫 Substance Abuse

3. **Click "Request Access"**
   - Demo loads `valid-proof.json` automatically
   - MetaMask popup appears
   - Gas estimate: ~16,000,000
   - Cost: ~$2.40 USD

4. **Approve Transaction**
   - Wait 15-30 seconds (ZK verification is slower)
   - Transaction appears in history
   - Privacy metrics calculate

**Contract Used:** HybridV4 (`0x620f...867`)

---

## 📊 Understanding the Dashboard

### Left Panel - Statistics

#### Basic Counts
- **Total Operations:** Count of all access requests
- **Routine Operations:** RBAC-based accesses (green)
- **Sensitive Operations:** ZK-proof-based accesses (yellow)
- **Success Rate:** Percentage of successful transactions

#### Cost Metrics
- **Total Cost:** Cumulative ETH spent
- **Gas Savings vs AllZK:** Percentage saved compared to all-ZK approach

#### Privacy Metrics
- **Privacy Budget (ε):** Differential privacy measure
  - Higher = more information leakage
  - ε = 4.47 indicates pathway distinguishability
- **Mutual Information (MI):** Correlation between gas and pathway
  - MI = 1.0 = perfect correlation (pathway fully distinguishable)

#### Performance Metrics
- **Coefficient of Variation:** Consistency measure
  - <1% = excellent consistency
  - Shows predictable gas consumption
- **Cohen's d:** Statistical significance
  - >14,000 = extremely significant difference

#### Scalability Metrics
- **Daily Capacity:** Projected operations per day
- **Annual Cost:** Cost at 10,000 daily transactions

### Right Panel - Analytics

#### Performance Analytics (Charts)
- **Average Gas Consumption:** Bar chart comparing routine vs sensitive
- **Operation Distribution:** Pie chart showing ratio

#### Key Findings
Blue alert banner showing:
- **Gas Differential:** 87.6× higher for ZK operations
- **Cost Savings:** Percentage vs all-ZK approach
- **Statistical Significance:** Cohen's d value
- **Privacy Loss:** ε and MI values

#### Model Comparison Table
Compares your live demo data against dissertation research results:
- AllNonZK (testnet baseline)
- HybridV4 (testnet results)
- AllZK (testnet maximum privacy)

#### Transaction History
- **Color Coded:** Green = routine, Yellow = sensitive
- **Details:** Patient, data type, gas used, cost
- **Etherscan Link:** Click to view on blockchain explorer

---

## 🔧 Troubleshooting

### MetaMask Connection Issues

**Problem:** "Please switch to Sepolia Testnet" error

**Solution:**
```
1. Open MetaMask
2. Click network dropdown (top)
3. Select "Sepolia test network"
4. If not visible:
   - Settings → Advanced → Show test networks (ON)
```

### Insufficient Funds

**Problem:** Transaction fails with "insufficient funds"

**Solution:**
```
1. Check balance in MetaMask
2. Need ~0.01 ETH for routine, ~0.02 ETH for sensitive
3. Get more from: https://sepoliafaucet.com/
```

### ZK Proof Not Found

**Problem:** "valid-proof.json not found" error

**Solution:**
```
1. Ensure valid-proof.json is in SAME folder as HTML file
2. File structure should be:
   demo/
   ├── hybrid-ehr-demo.html
   └── valid-proof.json  ← Must be here!
3. Refresh browser after adding file
```

### Transaction Pending Forever

**Problem:** Transaction shows "Processing..." but never completes

**Solution:**
```
1. Check MetaMask - approve the transaction
2. Testnet congestion - wait 1-2 minutes
3. If >5 minutes, check Sepolia status: https://sepolia.etherscan.io/
4. Cancel and retry transaction
```

### Wrong Network

**Problem:** Contracts not responding

**Solution:**
```
1. Verify you're on Sepolia (Chain ID: 11155111)
2. Check console (F12) for errors
3. Disconnect and reconnect MetaMask
```

---

## 💡 Demo Scenarios

### Scenario 1: Compare Gas Costs

**Goal:** Show 87.6× gas differential

```
1. Make 1 routine access (Vital Signs)
   → Note gas: ~183K
2. Make 1 sensitive access (Mental Health)
   → Note gas: ~16M
3. View "Gas Differential" metric
   → Shows: 87.6×
```

### Scenario 2: Privacy vs Performance

**Goal:** Demonstrate trade-off

```
1. Make several routine accesses (3-5)
   → Fast (~5s each), cheap (~$0.03 each)
2. Make several sensitive accesses (3-5)
   → Slower (~20s each), expensive (~$2.40 each)
3. View "Key Findings" banner
   → Cost Savings: ~60-70% vs AllZK
   → Privacy Loss: ε = 4.47 (pathway distinguishable)
```

### Scenario 3: Statistical Significance

**Goal:** Show Cohen's d effect size

```
1. Make at least 5 routine + 5 sensitive accesses
2. View "Cohen's d Effect Size" stat
   → Should show >10,000 (extremely significant)
3. Check "Model Comparison" table
   → Your demo matches research findings
```

---

## 🎓 Educational Use

### For Presentations

**Recommended Flow:**
1. **Connect wallet** (show MetaMask integration)
2. **Routine access** (show fast, cheap operation)
3. **Sensitive access** (show ZK proof requirement)
4. **Point out gas differential** in charts
5. **Explain privacy metrics** (ε, MI)
6. **Show cost savings** vs all-ZK

### For Demonstrations

**Key Points to Highlight:**
- Unified `requestAccess()` interface (both operations look the same)
- 87.6× performance difference (visible in charts)
- Privacy-performance trade-off (ε = 4.47)
- Real blockchain transactions (show Etherscan)

### For Video Recording

**Screen Recording Tips:**
1. Full-screen browser (hide bookmarks)
2. Zoom in slightly (Ctrl/Cmd +)
3. Pre-connect MetaMask
4. Have 0.05 ETH ready
5. Show both routine AND sensitive operations
6. Highlight stat changes in real-time

---

## 📱 Mobile Support

**Limited mobile support:**
- Mobile MetaMask app can open dapps
- Performance may vary
- Desktop recommended for presentations

---

## 🔗 Deployed Contracts

All contracts deployed on **Ethereum Sepolia Testnet:**

| Contract | Address | Etherscan |
|----------|---------|-----------|
| AllNonZK | `0x28472d124F9eBd34DfacD7b11eDe80E12fc337e1` | [View](https://sepolia.etherscan.io/address/0x28472d124F9eBd34DfacD7b11eDe80E12fc337e1) |
| HybridV4 | `0x620f15963721bEA41ceEA5688b5223b340F1B867` | [View](https://sepolia.etherscan.io/address/0x620f15963721bEA41ceEA5688b5223b340F1B867) |
| AllZK | `0x75E5bBaF31E489E12D7Be680b4D985108f22a7C8` | [View](https://sepolia.etherscan.io/address/0x75E5bBaF31E489E12D7Be680b4D985108f22a7C8) |

---

## 🗂️ Patient Data

Demo uses **16 synthetic patients** registered on-chain from `ipfs-mapping.json`:

**Routine Patients (8):**
- Caryl47 Cassin499
- Fernando603 Conroy74
- Marion502 Hirthe744
- Philip822 Lindgren255
- Garnet389 Bernier607
- Mac103 Douglas31
- Maryrose226 Kessler503
- Julius90 Kirlin939

**Sensitive Patients (8):**
- Britt177 Keeling57
- Tobias236 Harris789
- Lu473 Schimmel440
- Hortencia577 Renner328
- Gustavo235 Konopelski743
- Hugh686 Kautzer186
- Victorina579 Yost751
- Wilson960 Leuschke194

---

## ⚙️ Advanced Configuration

### Changing Gas Price

Edit line ~126 in HTML file:
```javascript
const CONFIG = {
    GAS_PRICE_GWEI: 50,  // Change to current gas price
    ETH_PRICE_USD: 3000  // Update ETH price
};
```

### Using Different Contracts

Edit lines 123-125:
```javascript
ALLNONZK_ADDRESS: '0x...',  // Your deployed address
HYBRIDV4_ADDRESS: '0x...',  // Your deployed address
ALLZK_ADDRESS: '0x...'      // Your deployed address
```

### Custom Valid Proof

Replace `valid-proof.json` with your own:
```bash
# In circuits folder
node generate-valid-proof.js

# Copy to demo folder
cp circuits/valid-proof.json demo/
```

---

## 📊 Performance Expectations

| Operation | Gas | Time | Cost (50 gwei) |
|-----------|-----|------|----------------|
| Routine Access | ~183K | 5-10s | $0.027 |
| Sensitive Access | ~16M | 15-30s | $2.40 |
| Connect Wallet | - | 2-5s | Free |
| Load Proof | - | <1s | Free |

*Times vary based on network congestion*

---

## ⚠️ Limitations

1. **Test Network Only:** Uses Sepolia testnet, not production
2. **Single Proof Reuse:** Same ZK proof works for all patients (demo simplification)
3. **No Key Management:** Private key security handled by MetaMask
4. **Synthetic Data:** Uses Synthea-generated patient records
5. **Gas Pattern Leakage:** Transaction analysis reveals operation type (ε = 4.47)

---

## 🤝 Support

**Issues?**
- Check console (F12) for errors
- Verify network (Sepolia only)
- Ensure files in correct locations
- See main [README.md](../README.md) for full documentation

**Questions?**
Contact: kirthifb1@gmail.com

---

## 📖 Related Documentation

- [Main Project README](../README.md)
- [Smart Contract Documentation](../contracts/README.md)
- [Circuit Documentation](../circuits/README.md)
- [Benchmark Results](../data/benchmarks/README.md)

---

**Happy Demonstrating! 🎉**