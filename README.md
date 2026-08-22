# Smart Contract FixGPT

AI-powered Solidity smart contract vulnerability detection, remediation, re-analysis, and security reporting.

## Live Demo

**Frontend:**  
https://smart-contract-fixgpt.vercel.app/

**GitHub:**  
https://github.com/mummanavasanthi/smart-contract-fixgpt

---

## Project Overview

Smart Contract FixGPT is a Web3 + AI cybersecurity platform designed to analyze Solidity smart contracts for security issues and assist developers in fixing them.

The platform combines:

- Solidity smart contracts
- Slither static security analysis
- Gemini AI
- Node.js and Express
- React
- Automated re-analysis
- Security scoring
- PDF security reporting

The main workflow is:

> **Detect → Explain → Fix → Re-Analyze → Report**

The goal is to make smart contract security analysis easier and more accessible for Solidity and Web3 developers.

---

## Problem Statement

Smart contract vulnerabilities can lead to serious financial and security risks in Web3 applications.

Developers may detect an issue using security tools, but understanding the vulnerability, its impact, and the correct remediation can still require significant security knowledge.

Smart Contract FixGPT combines static analysis with AI-assisted remediation to provide a single workflow for:

1. Detecting vulnerabilities
2. Explaining the security issue
3. Generating a remediation proposal
4. Re-analyzing the corrected contract
5. Showing resolved and remaining findings
6. Generating a security report

---

## Features

### Solidity Contract Input

Users can:

- Paste Solidity source code
- Upload `.sol` files

### Static Security Analysis

The application uses **Slither** to analyze Solidity smart contracts.

Detected findings can include:

- Reentrancy
- `tx.origin` misuse
- Arbitrary ETH transfers
- Low-level calls
- Solidity compiler-version warnings
- Optimization findings

### Severity Classification

Findings are categorized using Slither's impact information:

- High
- Medium
- Low
- Informational
- Optimization

### AI Security Analysis

Gemini AI is used to:

- Explain vulnerabilities
- Explain security impact
- Recommend remediation
- Generate corrected Solidity code

### AI-Generated Fix

The platform generates a complete Solidity remediation proposal while attempting to preserve the original contract's intended behavior.

### Re-Analysis

The generated contract is scanned again using Slither.

The system compares:

```text
Before → After
