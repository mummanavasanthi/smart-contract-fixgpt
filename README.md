# Smart Contract FixGPT

### AI-Powered Smart Contract Vulnerability Detection and Secure Fix Generation

Smart Contract FixGPT is a **Web3 + AI cybersecurity platform** that analyzes Solidity smart contracts, detects security issues, explains vulnerabilities using AI, generates remediation proposals, re-analyzes the fixed contract, and generates a security report.

---

## Live Demo

**Frontend:**  
https://smart-contract-fixgpt.vercel.app/

**GitHub Repository:**  
https://github.com/mummanavasanthi/smart-contract-fixgpt

---

# 1. Project Overview

Smart contracts are an important part of Web3 applications, but security vulnerabilities in smart contracts can lead to serious financial and operational risks.

Smart Contract FixGPT combines:

- Solidity smart contracts
- Slither static security analysis
- Google Gemini AI
- React
- Node.js and Express
- Docker
- Automated re-analysis
- Security scoring
- PDF security reporting

The main workflow of the system is:

**Detect → Explain → Fix → Re-Analyze → Report**

The goal is to help developers understand smart-contract security issues and obtain AI-assisted remediation suggestions through a simple interface.

---

# 2. Problem Statement

Developers can use static-analysis tools to detect smart-contract vulnerabilities, but understanding and fixing those vulnerabilities can still require significant security knowledge.

A typical security workflow may require developers to:

1. Detect a vulnerability.
2. Understand why it occurs.
3. Understand its security impact.
4. Find an appropriate remediation.
5. Modify the contract.
6. Test whether the issue has actually been resolved.
7. Prepare a security report.

Smart Contract FixGPT combines these activities into a single workflow.

---

# 3. Objectives

The main objectives of the project are:

- Detect vulnerabilities in Solidity smart contracts.
- Provide vulnerability severity and confidence information.
- Explain security issues using AI.
- Generate AI-assisted Solidity remediation code.
- Re-analyze the generated code.
- Compare original and fixed results.
- Display resolved and remaining findings.
- Calculate a security score.
- Generate a downloadable security report.

---

# 4. Core Workflow

```text
          Solidity Smart Contract
                    |
                    v
          Slither Static Analysis
                    |
                    v
             Security Findings
                    |
                    v
              Gemini AI
                    |
          +---------+---------+
          |                   |
          v                   v
     Explanation        Remediation
                          Proposal
                              |
                              v
                    Corrected Solidity
                              |
                              v
                   Slither Re-Analysis
                              |
                              v
                   Before / After Compare
                              |
                    +---------+---------+
                    |                   |
                    v                   v
                Resolved            Remaining
                    |                   |
                    +---------+---------+
                              |
                              v
                       Security Report
