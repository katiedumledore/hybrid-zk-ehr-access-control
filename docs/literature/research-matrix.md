# Literature Review Matrix

## CORE PAPERS (Deep Analysis Required - 8 papers)
*Focus: Direct relevance to hybrid ZKP-blockchain EHR systems*

| Paper | Year | Key Contribution | Limitations | Relevance | Reading Status |
|-------|------|------------------|-------------|-----------|----------------|
| A decentralized and privacy-preserving framework for electronic health records using blockchain (Alahmari et al.) | 2025 | ZKP + homomorphic encryption + blockchain EHRs | Need to identify performance bottlenecks | 5/5 | Completed |
|Blockchain-based Decentralized Healthcare Data Management System with Zero Knowledge Proof Ring Signature for Secure, Tamper-Proof, and Privacy-Preserving Storage  (Shanmugham et al.) | 2025 | Universal ZKP + Ring Signature approach for all EHR operations | Single-path architecture lacks routing optimization | 5/5 | Completed |
| Ensuring Electronic Health Record (EHR) Privacy using Zero Knowledge Proofs (ZKP) and Secure Encryption Schemes on Blockchain (Ranaweera et al.) | 2023 | ZKP for authentication + Homomorphic Encryption for data processing | Universal cryptographic application to all operations (ZKP + HE) | 5/5 | Completed |
| ACHealthChain blockchain framework for access control and privacy preservation (Tawfik et al.) | 2025 | 19.7% throughput improvement, 87% latency reduction | Limited to Hyperledger Fabric | 5/5 | Completed |
| A hybrid blockchain-based solution for secure sharing of EMR data (Han et al.) | 2025 | Tripartite blockchain architecture, cross-chain algorithms | Complexity of multi-chain management | 5/5 | Completed |
| BBAC: Blockchain-Based Access Control Scheme for EHRs (Qin et al.) | 2023 | Homomorphic encryption for genomic data access control | Focus on genomic data, not general EHR | 5/5 | Completed |
| Block chain enabled hybrid cryptographic algorithm (Ananda Babu et al.) | 2025 | SHACLSM-PRE hybrid algorithm performance evaluation | Limited to specific crypto combination | 5/5 | Completed |
| Attribute-based access control scheme for EHRs using blockchain and IPFS (Kaur et al.) | 2023 | CP-ABE + blockchain, smart contracts with permissions | Scalability concerns with IPFS | 4/5 | Completed |
| Blockchain-Based HSFO Framework (Lakshmanan et al.) | 2025 | Hybrid optimization: Sunflower + Firefly algorithms | Novel but unproven algorithm combination | 4/5 | Completed |
| Blockchain-Based Secure Multiple Computation Scheme (VasanthaRani) | 2025 | Homomorphic encryption + smart contracts for insurance | Specific to insurance verification use case | 4/5 | Completed |

## SUPPORTING PAPERS (Moderate Analysis - 11 papers)
*Focus: Background, context, and comparative baselines*

| Paper | Year | Key Contribution | Limitations | Relevance | Reading Status |
|-------|------|------------------|-------------|-----------|----------------|
| MedRec: Using Blockchain for Medical Data Access (Azaria et al.) | 2016 | Foundational blockchain EHR, modular design | Early work, limited crypto sophistication | 4/5 | Completed |
| Securing e-health records using keyless signature infrastructure (Nagasubramanian et al.) | 2020 | 50% response time improvement, cost analysis | No ZKP integration | 3/5 | Completed |
| Secure Access Control for EHRs in Blockchain-Enabled IoMT (Hong et al.) | 2024 | Attribute-based encryption, policy management | IoT-specific, not general access control | 3/5 | Completed |
| A Secured Blockchain Database Management Model (Irikefe et al.) | 2025 | Smart contract implementation, MetaMask integration | Basic implementation, limited evaluation | 3/5 | Completed |
| hChain: Blockchain Based Large Scale EHR Data Sharing (Alruwaill et al.) | 2025 | Large-scale performance, edge computing integration | Focus on IoMT rather than access control | 3/5 | Completed |
| Blockchain-based EHR storage and access control system (Gupta et al.) | 2023 | Patient ownership, data tampering prevention | Conceptual, limited implementation | 3/5 | Completed |
| Flexible and secure access control for EHR sharing (Li et al.) | 2024 | EHR sharing mechanisms | Abstract only, need full paper | 3/5 | Completed |
| Secure EHR Distribution in Blockchain Enabled H-IoT (Sahoo et al.) | 2025 | Hyperledger implementation, scalability assessment | Healthcare IoT focus | 3/5 | Completed |
| Enhanced Data Integrity: Leveraging Blockchain in Healthcare (Koulianos et al.) | 2024 | Legacy system integration challenges | Integration focus, not access control | 2/5 | Completed |
| Generating design knowledge for blockchain-based PHR access control (Meier et al.) | 2021 | Design principles, meta-requirements methodology | Personal health records, not EHRs | 3/5 | Completed |
| A blockchain-based keyword search scheme with dual authorization (Yang et al.) | 2022 | Dual authorization mechanisms for EHR sharing | Search-specific, not general access control | 2/5 | Completed |

## REFERENCE ONLY PAPERS (Background/Citations - 6 papers)
*Focus: Background context and general blockchain/crypto concepts*

| Paper | Year | Usage for Research |
|-------|------|--------------------|
| A Survey of Blockchain-Based Strategies for Healthcare (De Aguiar et al.) | 2021 | Background survey for introduction/related work |
| A Systematic Review of Blockchain in Healthcare (Garg) | 2022 | Systematic review for literature foundation |
| Blockchain based access control systems: State of the art (Rouhani & Deters) | 2019 | General access control challenges across domains |
| Blockchain security enhancement: hybrid consensus algorithms (Venkatesan & Rahayu) | 2024 | Hybrid consensus background (not healthcare-specific) |
| A novel hybrid cryptographic framework for cloud computing (Shivaramakrishna & Nagaratna) | 2023 | Hybrid cryptography background (non-healthcare) |
| Enabling Seamless Cyber-Healthcare Interoperability (Garikipati) | 2025 | FHIR + blockchain integration context |

## RESEARCH GAPS IDENTIFIED
Based on core paper analysis:

1. **Performance-Privacy Trade-off Gap**: No direct comparison of ZKP-only vs hybrid approaches with specific metrics
2. **Sensitivity Classification Missing**: Limited work on granular sensitivity-based routing  
3. **Consent Verification Focus**: Most papers address general access control, not consent scenarios
4. **Quantitative Hybrid Analysis**: Missing systematic evaluation of hybrid vs all-ZK systems

## READING PLAN
- **Week 1 Days 2-3**: Core Papers 1-4 (most relevant)
- **Week 1 Days 4-5**: Core Papers 5-8 (hybrid approaches) 
- **Week 1 Day 6**: Supporting Papers 1-3 (foundational)

## NOTES TEMPLATE
For each core paper, capture:
- **Problem Addressed**: [1 sentence]
- **Hybrid Approach Used**: [specific techniques]
- **Performance Metrics**: [what they measured]
- **Limitations for My Research**: [gaps I can address]
- **Useful for My Framework**: [specific ideas to adopt]