# Smart Contract FixGPT

> AI-powered Solidity smart contract vulnerability detection, remediation, re-analysis, and security reporting.

[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Smart Contracts](https://img.shields.io/badge/Web3-Solidity-363636?logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Security Analysis](https://img.shields.io/badge/Security-Slither-6C63FF)](https://github.com/crytic/slither)
[![AI](https://img.shields.io/badge/AI-Google%20Gemini-4285F4)](https://ai.google.dev/)
[![Deployment](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com/)
[![Deployment](https://img.shields.io/badge/Backend-Railway-0B0D0E)](https://railway.app/)

---

## Live Demo

**Frontend:**  
https://smart-contract-fixgpt.vercel.app/

**GitHub Repository:**  
https://github.com/mummanavasanthi/smart-contract-fixgpt

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [Core Workflow](#core-workflow)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Supported Security Findings](#supported-security-findings)
- [Testing](#testing)
- [Example Results](#example-results)
- [API](#api)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Production Deployment](#production-deployment)
- [Security Considerations](#security-considerations)
- [Limitations](#limitations)
- [Future Enhancements](#future-enhancements)
- [Project Status](#project-status)
- [Disclaimer](#disclaimer)

---

## Overview

Smart Contract FixGPT is a **Web3 + AI + Cybersecurity** platform designed to help developers identify and remediate vulnerabilities in Solidity smart contracts.

The platform combines:

- **Solidity** smart contracts
- **Slither** static security analysis
- **Google Gemini AI** for explanation and remediation
- **Node.js + Express** backend services
- **React + Vite** frontend
- **Automated re-analysis** of AI-generated fixes
- **Security scoring**
- **Downloadable PDF security reports**

The system follows a simple security workflow:

> **Detect → Explain → Fix → Re-Analyze → Report**

The goal is to make smart contract security analysis easier for Solidity and Web3 developers while keeping the remediation process practical and developer-friendly.

---

## Problem Statement

Smart contracts are immutable programs that may control valuable digital assets. Security vulnerabilities in smart contracts can therefore lead to serious financial and operational consequences.

Although static analysis tools can identify many common problems, developers may still need to understand:

- What the vulnerability means
- Why it is dangerous
- What part of the contract is affected
- How to remediate it safely
- Whether the proposed fix actually removes the finding

Smart Contract FixGPT addresses this gap by combining automated static analysis with AI-assisted explanation and remediation.

---

## Objectives

The project is designed to:

1. Accept Solidity smart contract source code.
2. Detect security findings using Slither.
3. Display finding severity, confidence, function, and description.
4. Use Gemini AI to explain actionable vulnerabilities.
5. Generate corrected Solidity code.
6. Re-analyze the generated contract using Slither.
7. Compare the original and fixed results.
8. Show resolved and remaining findings.
9. Calculate a security score.
10. Generate a downloadable security report.

---

# Core Workflow

```text
                Solidity Smart Contract
                         │
                         ▼
                  Static Analysis
                      Slither
                         │
                         ▼
                  Security Findings
                         │
                ┌────────┴────────┐
                │                 │
                ▼                 ▼
         Informational       Actionable
           Findings           Findings
                                │
                                ▼
                           Gemini AI
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
              Explanation            Remediation
                                      + Fixed Code
                    │                       │
                    └───────────┬───────────┘
                                ▼
                         Slither Re-Analysis
                                │
                                ▼
                     Before / After Comparison
                                │
                                ▼
                      Resolved / Remaining
                                │
                                ▼
                         Security Report
