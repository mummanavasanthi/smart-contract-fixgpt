import { useState } from "react";
import jsPDF from "jspdf";
import "./App.css";
import * as XLSX from "xlsx";
function App() {
    const [code, setCode] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fileName, setFileName] = useState("");

    // =====================================================
    // ANALYZE CONTRACT
    // =====================================================

    const analyzeContract = async () => {
        if (!code.trim()) {
            setError("Please enter Solidity code.");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        try {
                        const response = await fetch(
                        "https://smart-contract-fixgpt-lbkc.onrender.com/analyze",                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        code: code
                    })
                }
            );

            const data = await response.json();

           if (!response.ok || !data.success) {
    throw new Error(
        data.error ||
        data.message ||
        "Analysis failed"
    );
}

            setResult(data);

        } catch (err) {
            setError(
                err.message ||
                "Failed to connect to backend."
            );
        } finally {
            setLoading(false);
        }
    };


    // =====================================================
    // FILE UPLOAD
    // =====================================================

    const handleFileUpload = (event) => {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        if (
            !file.name
                .toLowerCase()
                .endsWith(".sol")
        ) {
            setError(
                "Please select a Solidity (.sol) file."
            );
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            setCode(e.target.result);
            setFileName(file.name);
            setError("");
            setResult(null);
        };

        reader.onerror = () => {
            setError(
                "Could not read the selected file."
            );
        };

        reader.readAsText(file);
    };


    // =====================================================
    // COPY FIXED CODE
    // =====================================================

    const copyFixedCode = async () => {
        if (!result?.fixedCode) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                result.fixedCode
            );

            alert(
                "Fixed Solidity code copied!"
            );

        } catch (err) {
            setError(
                "Could not copy the fixed code."
            );
        }
    };


    // =====================================================
    // SEVERITY COUNT
    // =====================================================

    const getSeverityCount = (
        findings,
        severity
    ) => {
        return (
            findings?.filter(
                (finding) =>
                    finding.severity === severity
            ).length || 0
        );
    };

    // Human-friendly finding guidance for the UI and PDF report.
   
const findingGuidance = {
    "reentrancy-eth": {
        title: "Reentrancy Vulnerability",
        recommendation:
            "Prevent external calls from re-entering a function before the contract has completed its state updates.",
        resolution:
            "Update balances and other critical state before external calls. Apply checks-effects-interactions and consider a reentrancy guard."
    },
    "reentrancy-no-eth": {
        title: "Reentrancy Vulnerability",
        recommendation:
            "Prevent re-entry into functions that modify shared state during an external interaction.",
        resolution:
            "Update state before external calls and use a reentrancy guard where necessary. Test nested calls and failure paths."
    },
    "arbitrary-send-eth": {
        title: "Arbitrary ETH Transfer",
        recommendation:
            "Ensure ETH can only be transferred to authorized destinations and in permitted amounts.",
        resolution:
            "Validate recipients and amounts, enforce appropriate authorization, and test unauthorized transfer attempts."
    },
    "tx-origin": {
        title: "tx.origin Authentication",
        recommendation:
            "Do not use tx.origin to authenticate callers because intermediary contracts can exploit this trust relationship.",
        resolution:
            "Use msg.sender for direct caller authorization or an appropriate role-based access-control mechanism."
    },
    "divide-before-multiply": {
        title: "Divide Before Multiply",
        recommendation:
            "Review the arithmetic order because integer division truncates fractional values before subsequent multiplication.",
        resolution:
            "Where mathematically appropriate, multiply before dividing, check for overflow and rounding effects, and add tests for small and boundary values."
    },
    "unchecked-lowlevel": {
        title: "Unchecked Low-Level Call",
        recommendation:
            "Handle the success or failure of every low-level call explicitly.",
        resolution:
            "Capture the call's success flag, revert or handle failures safely, and test calls to contracts that revert or return unexpected data."
    },
    "low-level-calls": {
        title: "Low-Level Call Usage",
        recommendation:
            "Review low-level calls for unsafe targets, unexpected return data, and unhandled failures.",
        resolution:
            "Validate the target, check the returned success flag, and prefer safer typed interfaces when practical."
    },
    "controlled-delegatecall": {
        title: "Input-Controlled Delegatecall",
        recommendation:
            "Prevent untrusted users from choosing arbitrary delegatecall targets.",
        resolution:
            "Restrict targets to trusted implementations and enforce access control. Test storage and authorization boundaries."
    },
    "unchecked-transfer": {
        title: "Unchecked Transfer",
        recommendation:
            "Ensure the result of a value transfer is handled correctly.",
        resolution:
            "Check the returned success value for low-level transfers and safely handle failure without leaving inconsistent state."
    },
    "timestamp": {
        title: "Block Timestamp Dependence",
        recommendation:
            "Avoid relying on block timestamps for precise timing or secure randomness.",
        resolution:
            "Use timestamps only for suitable time-based conditions. Use a secure randomness mechanism if unpredictable values are required."
    },
    "weak-prng": {
        title: "Weak Randomness",
        recommendation:
            "Do not use predictable blockchain values as security-sensitive randomness.",
        resolution:
            "Use an appropriate verifiable randomness solution for applications that depend on unpredictable outcomes."
    },
    "missing-zero-check": {
        title: "Missing Zero-Address Check",
        recommendation:
            "Prevent critical addresses from being accidentally set to address(0).",
        resolution:
            "Validate address inputs before storing or using them, particularly owners, recipients, and implementation addresses."
    },
    "unprotected-upgrade": {
        title: "Unprotected Upgrade",
        recommendation:
            "Restrict contract upgrades to explicitly authorized accounts or governance.",
        resolution:
            "Add suitable ownership or role-based authorization and test unauthorized upgrade attempts."
    },
    "suicidal": {
        title: "Unprotected Contract Destruction",
        recommendation:
            "Prevent unauthorized callers from destroying the contract or triggering destructive operations.",
        resolution:
            "Review whether destruction is necessary and enforce strict authorization and relevant operational safeguards."
    },
    "incorrect-equality": {
        title: "Incorrect Equality Check",
        recommendation:
            "Verify that equality conditions correctly represent the intended business logic and boundary cases.",
        resolution:
            "Review the affected condition and test values immediately below, at, and above the intended boundary."
    },
    "immutable-states": {
        title: "Immutable State Optimization",
        recommendation:
            "Consider making state variables immutable when they are assigned only during construction.",
        resolution:
            "Verify that the variable never needs to change after deployment, then declare it immutable and rerun compilation and tests."
    },
    "solc-version": {
        title: "Solidity Compiler Version",
        recommendation:
            "Review the compiler-version warning and determine whether the selected version is affected by relevant known bugs.",
        resolution:
            "Consult the official Solidity bug list, choose an appropriate patched compiler version, and recompile and retest the contract."
    },
    "naming-convention": {
        title: "Naming Convention",
        recommendation:
            "Use consistent Solidity naming conventions to improve code readability and maintainability.",
        resolution:
            "Rename identifiers to follow the project's naming conventions and update references and tests."
    },
        "reentrancy-benign": {
        title: "Benign Reentrancy",
        recommendation:
            "Review whether re-entry can affect shared state or violate expected execution order.",
        resolution:
            "Inspect external calls and state updates, then add regression tests for nested calls and failure paths."
    },

    "reentrancy-events": {
        title: "Reentrancy and Event Ordering",
        recommendation:
            "Check whether an external call can cause events to be emitted in a misleading order.",
        resolution:
            "Review event emission relative to state changes and external interactions. Add tests that verify event order."
    },

    "uninitialized-state": {
        title: "Uninitialized State Variable",
        recommendation:
            "Check whether the state variable can be read before receiving its intended value.",
        resolution:
            "Initialize the variable during declaration, construction, or a properly authorized setup function, as appropriate."
    },

    "uninitialized-local": {
        title: "Uninitialized Local Variable",
        recommendation:
            "Check whether the local variable may be used before receiving a valid value.",
        resolution:
            "Initialize the variable explicitly and test all control-flow paths to ensure it is assigned before use."
    },

    "shadowing-state": {
        title: "State Variable Shadowing",
        recommendation:
            "Review whether a declaration shadows another state variable and causes confusing or unintended behavior.",
        resolution:
            "Rename the shadowing variable and verify that assignments and reads refer to the intended declaration."
    },

    "shadowing-local": {
        title: "Local Variable Shadowing",
        recommendation:
            "Check whether a local declaration hides another variable and makes the code harder to reason about.",
        resolution:
            "Use distinct variable names and test the affected logic after updating references."
    },
    "calls-loop": {
        title: "External Calls in a Loop",
        recommendation:
            "Review external calls inside loops for gas-cost and failure risks as the number of iterations grows.",
        resolution:
            "Bound loop size where practical, consider pull-based operations, and test worst-case gas usage and failure handling."
    },
    "costly-loop": {
        title: "Potentially Costly Loop",
        recommendation:
            "Determine whether loop execution can become too expensive as the collection or input grows.",
        resolution:
            "Measure gas usage for realistic worst-case inputs and consider bounded processing or pagination where appropriate."
    },
    "incorrect-modifier": {
        title: "Incorrect Modifier Usage",
        recommendation:
            "Verify that function modifiers enforce the intended authorization and execution conditions.",
        resolution:
            "Review modifier logic and ordering, then test authorized, unauthorized, and boundary cases."
    },
    "missing-inheritance": {
        title: "Missing Inheritance",
        recommendation:
            "Review whether the contract is missing intended inherited behavior or interface implementation.",
        resolution:
            "Compare the contract against its design and interfaces, add only the required inheritance, and rerun compilation and tests."
    },

    "array-length-out-of-bounds": {
        title: "Array Bounds Risk",
        recommendation:
            "Check whether array indices and length assumptions are valid for every possible input.",
        resolution:
            "Validate index boundaries and test empty arrays, first and last valid indices, and out-of-range inputs."
    },
    "write-after-write": {
        title: "Redundant State Write",
        recommendation:
            "Review repeated writes to the same state variable to determine whether earlier writes are unnecessary.",
        resolution:
            "Remove redundant writes only after confirming the intended behavior, then rerun tests and compare gas usage."
    }
};

const getFindingDetails = (finding) => {
    const detector = String(finding?.name || "").toLowerCase();

    if (findingGuidance[detector]) {
        return findingGuidance[detector];
    }

    const title = detector
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

    // Detector-specific fallback: avoid presenting one generic
    // recommendation as if it were a verified mitigation.
    if (detector.includes("overflow") || detector.includes("underflow")) {
        return {
            title,
            recommendation:
                "Review the arithmetic operation and verify that its range and failure behavior match the intended logic.",
            resolution:
                "Validate input bounds, test extreme values, and use appropriate checked arithmetic or explicit safeguards."
        };
    }

    if (detector.includes("access") || detector.includes("authorization")) {
        return {
            title,
            recommendation:
                "Verify that only authorized accounts can access the affected operation or resource.",
            resolution:
                "Enforce the intended caller permissions and test unauthorized access attempts."
        };
    }

    if (detector.includes("delegatecall") || detector.includes("call")) {
        return {
            title,
            recommendation:
                "Review the external call target, authorization, return handling, and possible effects on contract state.",
            resolution:
                "Validate the target and caller permissions, handle failures explicitly, and test malicious or reverting callees."
        };
    }

    if (detector.includes("oracle") || detector.includes("price")) {
        return {
            title,
            recommendation:
                "Validate the reliability, freshness, and expected range of externally supplied price data.",
            resolution:
                "Check data freshness and validity, handle unavailable feeds safely, and test stale or abnormal values."
        };
    }

    if (detector.includes("loop") || detector.includes("dos") || detector.includes("denial")) {
        return {
            title,
            recommendation:
                "Check whether an operation can become too expensive or permanently blocked as input or state grows.",
            resolution:
                "Bound work where appropriate, test worst-case gas usage, and ensure one failing item cannot unnecessarily block unrelated operations."
        };
    }

    if (detector.includes("timestamp")) {
        return {
            title,
            recommendation:
                "Determine whether the contract relies on block timestamps for a security-sensitive decision.",
            resolution:
                "Account for timestamp limitations and avoid using timestamps as secure randomness or exact timing guarantees."
        };
    }

    if (detector.includes("reentrancy")) {
        return {
            title,
            recommendation:
                "Review external interactions for possible re-entry before state changes are complete.",
            resolution:
                "Apply checks-effects-interactions, update state before external calls, and consider a reentrancy guard."
        };
    }

    return {
        title: title || "Security Finding",
        recommendation:
            `Review the specific Slither detector "${detector}" and determine its impact on this contract before selecting a mitigation.`,
        resolution:
            "Inspect the reported source lines and detector documentation, implement a mitigation appropriate to the actual code, and rerun compilation, tests, and security analysis."
    };
};


    const originalFindings =
        result?.original?.findings || [];


    const highCount =
        getSeverityCount(
            originalFindings,
            "High"
        );

    const mediumCount =
        getSeverityCount(
            originalFindings,
            "Medium"
        );

    const lowCount =
        getSeverityCount(
            originalFindings,
            "Low"
        );

    const infoCount =
        getSeverityCount(
            originalFindings,
            "Informational"
        );

    const optimizationCount =
        getSeverityCount(
            originalFindings,
            "Optimization"
        );


    // =====================================================
    // SECURITY SCORE
    // =====================================================

    const weightedPenalty =
    (highCount * 25) +
    (mediumCount * 12) +
    (lowCount * 5) +
    (infoCount * 1) +
    (optimizationCount * 0.5);

const securityScore = Math.max(
    10,
    Math.round(100 - weightedPenalty)
);
const remainingFindings =
    result?.reanalysis?.remaining || [];

const resolvedFindings =
    result?.reanalysis?.resolved || [];

const originalCount = originalFindings.length;
const remainingCount = remainingFindings.length;
const resolvedCount = resolvedFindings.length;

// Trust Score: separate from Security Score
const resolutionRate =
    originalCount > 0
        ? resolvedCount / originalCount
        : 0;

const remainingPenalty =
    remainingFindings.reduce((total, finding) => {
        const severity = String(
            finding?.impact || finding?.severity || ""
        ).toLowerCase();

        if (severity === "high") return total + 20;
        if (severity === "medium") return total + 10;
        if (severity === "low") return total + 5;

        return total + 2;
    }, 0);
const trustScore = Math.max(
    0,
    Math.min(
        100,
        Math.round(
            70 +
            resolutionRate * 30 -
            remainingPenalty
        )
    )
);
const trustStatus =
    highCount > 0
        ? "High Risk - Critical Review Required"
        : mediumCount > 0
        ? "Needs Review - Medium Findings"
        : lowCount > 0
        ? "Review Recommended - Low Findings"
        : "No High, Medium, or Low Findings Detected";
    // =====================================================
    // DOWNLOAD SECURITY REPORT
    // =====================================================


const downloadExcelReport = () => {
    try {
        if (!result) {
            alert("Please analyze a Solidity contract first.");
            return;
        }

        const findings = result.original?.findings || [];
        const resolved = result.reanalysis?.resolved || [];
        const remaining = result.reanalysis?.remaining || [];

        // Convert a finding into a readable name.
        const getFindingName = (item) => {
            if (typeof item === "string") return item;

            return (
                item?.name ||
                item?.title ||
                item?.check ||
                JSON.stringify(item)
            );
        };

        // Sheet 1: Assessment Summary
        const summaryRows = [
            { Metric: "Report", Value: "Smart Contract FixGPT Security Assessment" },
            { Metric: "Contract File", Value: fileName || "Pasted Solidity Contract" },
            { Metric: "Security Score", Value: `${securityScore}/100` },
            { Metric: "Trust Score", Value: `${trustScore}/100` },
            { Metric: "Assessment Status", Value: trustStatus },
            { Metric: "Findings Before", Value: result.original?.count ?? findings.length },
            { Metric: "Findings After", Value: result.reanalysis?.count ?? remaining.length },
            { Metric: "High Findings", Value: highCount },
            { Metric: "Medium Findings", Value: mediumCount },
            { Metric: "Low Findings", Value: lowCount },
            { Metric: "Informational Findings", Value: infoCount },
            { Metric: "Optimization Findings", Value: optimizationCount },
            { Metric: "Resolved Findings", Value: resolved.length },
            { Metric: "Remaining Findings", Value: remaining.length },
            { Metric: "Generated On", Value: new Date().toLocaleString() },
            {
                Metric: "Disclaimer",
                Value: "AI-generated fixes require manual review, testing, and independent validation. This report does not guarantee contract security."
            }
        ];

        // Sheet 2: Detailed Security Findings
        const findingRows = findings.map((finding, index) => {
            const details = getFindingDetails(finding);

            return {
                "No.": index + 1,
                Severity: finding.severity || finding.impact || "N/A",
                "Finding Name": details.title || finding.name || "Security Finding",
                Detector: finding.name || "N/A",
                Confidence: finding.confidence || "N/A",
                Function: finding.function || "N/A",
                "Source Lines": Array.isArray(finding.lines)
                    ? [...new Set(finding.lines)].join(", ")
                    : "N/A",
                Description: finding.description || "N/A",
                Recommendation: details.recommendation || "Review the finding manually.",
                "How to Resolve": details.resolution || "Investigate and test an appropriate mitigation.",
                Reference: finding.reference || "N/A"
            };
        });

        // Sheet 3: Re-Analysis
        const reanalysisRows = [
            ...resolved.map((item) => ({
                Status: "Resolved",
                Finding: getFindingName(item),
                Details: "Reported as resolved by the re-analysis process."
            })),
            ...remaining.map((item) => ({
                Status: "Remaining",
                Finding: getFindingName(item),
                Details: "Requires review; confirm the issue and its severity."
            }))
        ];

        if (reanalysisRows.length === 0) {
            reanalysisRows.push({
                Status: "No re-analysis findings",
                Finding: "No resolved or remaining findings were returned.",
                Details: "Check the analysis results to confirm the assessment completed successfully."
            });
        }

        // Sheet 4: AI Analysis and Generated Fix
        const aiRows = [
            {
                Section: "AI Security Analysis",
                Content: result.ai?.explanation || "No AI explanation was returned."
            },
            {
                Section: "AI Syntax Correction Explanation",
                Content: result.syntaxFix?.explanation || "No syntax correction explanation was returned."
            },
            {
                Section: "AI Generated Fixed Solidity Code",
                Content: result.fixedCode || "No fixed Solidity code was returned."
            },
            {
                Section: "Syntax-Corrected Solidity Code",
                Content: result.syntaxFix?.fixedCode || "No syntax-corrected code was returned."
            }
        ];

        // Create workbook and sheets.
        const workbook = XLSX.utils.book_new();

        const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
        const findingsSheet = XLSX.utils.json_to_sheet(findingRows);
        const reanalysisSheet = XLSX.utils.json_to_sheet(reanalysisRows);
        const aiSheet = XLSX.utils.json_to_sheet(aiRows);

        // Set readable column widths.
        summarySheet["!cols"] = [
            { wch: 30 },
            { wch: 90 }
        ];

        findingsSheet["!cols"] = [
            { wch: 7 },
            { wch: 16 },
            { wch: 30 },
            { wch: 25 },
            { wch: 15 },
            { wch: 24 },
            { wch: 18 },
            { wch: 55 },
            { wch: 55 },
            { wch: 55 },
            { wch: 35 }
        ];

        reanalysisSheet["!cols"] = [
            { wch: 24 },
            { wch: 40 },
            { wch: 65 }
        ];

        aiSheet["!cols"] = [
            { wch: 35 },
            { wch: 100 }
        ];

        // Enable filters and freeze the header row.
        [findingsSheet, reanalysisSheet, aiSheet].forEach((sheet) => {
            if (sheet["!ref"]) {
                sheet["!autofilter"] = { ref: sheet["!ref"] };
                sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
            }
        });

        XLSX.utils.book_append_sheet(
            workbook, summarySheet, "Assessment Summary"
        );

        XLSX.utils.book_append_sheet(
            workbook, findingsSheet, "Security Findings"
        );

        XLSX.utils.book_append_sheet(
            workbook, reanalysisSheet, "Re-Analysis"
        );

        XLSX.utils.book_append_sheet(
            workbook, aiSheet, "AI Analysis & Fix"
        );

        XLSX.writeFile(
            workbook,
            "Smart_Contract_FixGPT_Security_Report.xlsx"
        );
    } catch (error) {
        console.error("Excel export failed:", error);
        alert("Could not export the Excel report. Check the browser console.");
    }
};

 const downloadReport = () => {
    try {
        if (!result) {
            alert("Please analyze a Solidity contract first.");
            return;
        }

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 18;
        const contentWidth = pageWidth - margin * 2;

        let y = 20;

        const findings =
            result.original?.findings || [];

        const resolved =
            result.reanalysis?.resolved || [];

        const remaining =
            result.reanalysis?.remaining || [];

        const addPage = () => {
            pdf.addPage();
            y = 20;
        };

        const checkSpace = (height = 10) => {
            if (y + height > pageHeight - 20) {
                addPage();
            }
        };

        const addHeading = (
            text,
            size = 14
        ) => {
            checkSpace(15);

            pdf.setFont(
                "helvetica",
                "bold"
            );

            pdf.setFontSize(size);

            pdf.setTextColor(
                17,
                24,
                39
            );

            pdf.text(
                String(text),
                margin,
                y
            );

            y += 9;
        };

        const addParagraph = (
            text,
            size = 9
        ) => {
            if (
                text === undefined ||
                text === null ||
                String(text).trim() === ""
            ) {
                return;
            }

            pdf.setFont(
                "helvetica",
                "normal"
            );

            pdf.setFontSize(size);

            const lines =
                pdf.splitTextToSize(
                    String(text),
                    contentWidth
                );

            const lineHeight = 4.5;
            const requiredHeight =
                lines.length *
                lineHeight +
                5;

            checkSpace(requiredHeight);

            pdf.text(
                lines,
                margin,
                y
            );

            y += requiredHeight;
        };

        const addLabel = (
            name,
            value
        ) => {
            checkSpace(7);

            pdf.setFont(
                "helvetica",
                "bold"
            );

            pdf.setFontSize(9);

            pdf.text(
                `${name}:`,
                margin,
                y
            );

            pdf.setFont(
                "helvetica",
                "normal"
            );

            const valueLines =
                pdf.splitTextToSize(
                    String(
                        value ?? "N/A"
                    ),
                    contentWidth - 32
                );

            pdf.text(
                valueLines,
                margin + 32,
                y
            );

            y +=
                Math.max(
                    5,
                    valueLines.length * 4
                );
        };

        // =================================================
        // PAGE 1 - SUMMARY
        // =================================================

        pdf.setFillColor(
            17,
            24,
            39
        );

        pdf.rect(
            0,
            0,
            pageWidth,
            42,
            "F"
        );

        pdf.setTextColor(
            255,
            255,
            255
        );

        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.setFontSize(21);

        pdf.text(
            "Smart Contract FixGPT",
            margin,
            18
        );

        pdf.setFont(
            "helvetica",
            "normal"
        );

        pdf.setFontSize(10);

        pdf.text(
            "AI-Powered Smart Contract Security Report | EtherAuthority Internship",
            margin,
            27
        );

        pdf.setTextColor(
            17,
            24,
            39
        );

        y = 55;

        addHeading(
            "Audit Summary"
        );

        addLabel(
            "Contract",
            fileName ||
            "Pasted Solidity Contract"
        );

        addLabel(
            "Findings Before",
            result.original?.count ?? 0
        );

        addLabel(
            "Findings After",
            result.reanalysis?.count ?? 0
        );

        addLabel(
            "Resolved",
            resolved.length
        );

        y += 5;

        // Score

        checkSpace(32);

        pdf.setFillColor(
            243,
            244,
            246
        );

        pdf.roundedRect(
            margin,
            y,
            contentWidth,
            30,
            4,
            4,
            "F"
        );

        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.setFontSize(11);

        pdf.text(
            "Security Score",
            margin + 8,
            y + 10
        );

        pdf.setFontSize(24);

        pdf.text(
            `${securityScore}/100`,
            margin + 8,
            y + 23
        );

        pdf.setFont(
            "helvetica",
            "normal"
        );

        pdf.setFontSize(8.5);

        pdf.text(
            "Project-defined score based on Slither findings.",
            margin + 58,
            y + 17
        );

        y += 40;

        // Finding summary

        addHeading(
            "Finding Summary"
        );

        const cards = [
            ["High", highCount],
            ["Medium", mediumCount],
            ["Low", lowCount],
            ["Informational", infoCount],
            ["Optimization", optimizationCount]
        ];

        const cardGap = 3;

        const cardWidth =
            (
                contentWidth -
                cardGap * 4
            ) / 5;

        cards.forEach(
            ([name, value], index) => {

                const x =
                    margin +
                    index *
                    (
                        cardWidth +
                        cardGap
                    );

                pdf.setFillColor(
                    247,
                    247,
                    247
                );

                pdf.roundedRect(
                    x,
                    y,
                    cardWidth,
                    23,
                    3,
                    3,
                    "F"
                );

                pdf.setFont(
                    "helvetica",
                    "bold"
                );

                pdf.setFontSize(15);

                pdf.text(
                    String(value),
                    x +
                    cardWidth / 2,
                    y + 11,
                    {
                        align:
                            "center"
                    }
                );

                pdf.setFont(
                    "helvetica",
                    "normal"
                );

                pdf.setFontSize(6.5);

                pdf.text(
                    name,
                    x +
                    cardWidth / 2,
                    y + 18,
                    {
                        align:
                            "center"
                    }
                );
            }
        );

        y += 34;

        addHeading(
            "Workflow"
        );

        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.setFontSize(10);

        pdf.text(
            "Detect  ->  Explain  ->  Fix  ->  Re-Analyze  ->  Report",
            margin,
            y
        );

        y += 8;

        addParagraph(
            "This report combines Slither static analysis with AI-assisted remediation and independent re-analysis of the proposed fixed contract.",
            9
        );

        // =================================================
        // FINDINGS
        // =================================================

        if (findings.length > 0) {

            addPage();

            addHeading(
                "Security Findings"
            );

            findings.forEach(
                (finding, index) => {

                    checkSpace(45);

                    pdf.setFillColor(
                        243,
                        244,
                        246
                    );

                    pdf.roundedRect(
                        margin,
                        y,
                        contentWidth,
                        9,
                        2,
                        2,
                        "F"
                    );

                    pdf.setFont(
                        "helvetica",
                        "bold"
                    );

                    pdf.setFontSize(
                        10.5
                    );

                    pdf.text(
                        `${index + 1}. ${finding.name}`,
                        margin + 5,
                        y + 6
                    );

                    y += 13;

                    addLabel(
                        "Severity",
                        finding.severity
                    );

                    addLabel(
                        "Confidence",
                        finding.confidence
                    );

                    addLabel(
                        "Function",
                        finding.function ||
                        "N/A"
                    );

                    const uniqueLines = [
                        ...new Set(
                            finding.lines || []
                        )
                    ];

                    addLabel(
                        "Source Lines",
                        uniqueLines.length > 0
                            ? uniqueLines.join(", ")
                            : "N/A"
                    );

                    addHeading(
                        "Description",
                        9
                    );

                    addParagraph(
                        finding.description,
                        8.5
                    );

                    const details =
                        getFindingDetails(
                            finding
                        );

                    addHeading(
                        "Recommendation",
                        9
                    );

                    addParagraph(
                        details.recommendation,
                        8.5
                    );

                    addHeading(
                        "How to Resolve",
                        9
                    );

                    addParagraph(
                        details.resolution,
                        8.5
                    );

                    if (
                        finding.reference
                    ) {
                        addHeading(
                            "Reference",
                            9
                        );

                        addParagraph(
                            finding.reference,
                            7.5
                        );
                    }

                    if (
                        index <
                        findings.length - 1
                    ) {
                        checkSpace(8);

                        pdf.setDrawColor(
                            220,
                            220,
                            220
                        );

                        pdf.line(
                            margin,
                            y,
                            pageWidth - margin,
                            y
                        );

                        y += 7;
                    }
                }
            );
        }

        // =================================================
        // AI SECURITY ANALYSIS
        // =================================================

        if (
            result.ai?.explanation
        ) {

            addPage();

            addHeading(
                "AI Security Analysis"
            );

            let aiText =
                String(
                    result.ai.explanation
                );

            aiText =
                aiText.replace(
                    /```[\s\S]*?```/g,
                    ""
                );

            aiText =
                aiText.replace(
                    /^#{1,6}\s*/gm,
                    ""
                );

            aiText =
                aiText.replace(
                    /^EXPLANATION:\s*/i,
                    ""
                );

            aiText =
                aiText.replace(
                    /\bFIXED CODE:\s*$/i,
                    ""
                );

            aiText =
                aiText.trim();

            addParagraph(
                aiText,
                8.7
            );
        }

        // =================================================
        // AI GENERATED FIX
        // =================================================

        if (
                result.fixedCode
            ) {
                checkSpace(45);

                addHeading(
                    "AI Generated Fix"
                );

            addParagraph(
                "AI-generated remediation proposal. The corrected contract was independently re-analyzed using Slither.",
                8.5
            );

            const codeLines =
                String(
                    result.fixedCode
                ).split("\n");

            const lineHeight = 4;

            codeLines.forEach(
                (line, index) => {

                    if (
                        y >
                        pageHeight - 25
                    ) {
                        checkSpace(45);

                        addHeading(
                            "AI Generated Fix - Continued"
                        );
                    }

                    const wrapped =
                        pdf.splitTextToSize(
                            line || " ",
                            contentWidth - 10
                        );

                    checkSpace(
                        wrapped.length *
                        lineHeight +
                        2
                    );

                    pdf.setFillColor(
                        31,
                        41,
                        55
                    );

                    pdf.setFont(
                        "courier",
                        "normal"
                    );

                    pdf.setFontSize(
                        7.2
                    );

                    pdf.setTextColor(
                        17,
                        24,
                        39
                    );

                    pdf.text(
                        wrapped,
                        margin + 5,
                        y
                    );

                    y +=
                        wrapped.length *
                        lineHeight;
                }
            );

            pdf.setTextColor(
                17,
                24,
                39
            );
        }

        // =================================================
        // RE-ANALYSIS
        // =================================================

        if (
                result.reanalysis
            ) {
                checkSpace(45);

                addHeading(
                    "Re-Analysis Results"
                );

            checkSpace(25);

            pdf.setFillColor(
                243,
                244,
                246
            );

            pdf.roundedRect(
                margin,
                y,
                contentWidth,
                24,
                3,
                3,
                "F"
            );

            pdf.setFont(
                "helvetica",
                "bold"
            );

            pdf.setFontSize(10);

            pdf.text(
                `Before: ${
                    result.original?.count ?? 0
                }`,
                margin + 8,
                y + 14
            );

            pdf.text(
                `After: ${
                    result.reanalysis?.count ?? 0
                }`,
                margin + 68,
                y + 14
            );

            pdf.text(
                `Resolved: ${
                    resolved.length
                }`,
                margin + 125,
                y + 14
            );

            y += 35;

            addHeading(
                "Resolved Findings"
            );

            if (
                resolved.length > 0
            ) {

                resolved.forEach(
                    (name) => {

                        checkSpace(8);

                        pdf.setFont(
                            "helvetica",
                            "bold"
                        );

                        pdf.setFontSize(9.5);

                        pdf.setTextColor(
                            22,
                            101,
                            52
                        );

                        pdf.text(
                            `[Resolved] ${name}`,
                            margin,
                            y
                        );

                        y += 7;
                    }
                );

            } else {

                addParagraph(
                    "No findings were resolved.",
                    9
                );
            }

            pdf.setTextColor(
                17,
                24,
                39
            );

            y += 6;

            addHeading(
                "Remaining Findings / Review"
            );

            if (
                remaining.length > 0
            ) {

                remaining.forEach(
                    (name) => {

                        checkSpace(8);

                        pdf.setFont(
                            "helvetica",
                            "bold"
                        );

                        pdf.setFontSize(9.5);

                        pdf.setTextColor(
                            146,
                            64,
                            14
                        );

                        pdf.text(
                            `[Review] ${name}`,
                            margin,
                            y
                        );

                        y += 7;
                    }
                );

            } else {

                addParagraph(
                    "No remaining findings.",
                    9
                );
            }

            pdf.setTextColor(
                17,
                24,
                39
            );
        }

        // =================================================
        // DISCLAIMER
        // =================================================

        checkSpace(35);

        addHeading(
            "Disclaimer"
        );

        addParagraph(
            "This report is generated using static analysis and AI-assisted remediation. AI-generated fixes are suggestions and must be manually reviewed, tested, and independently validated before deployment. A successful re-analysis does not guarantee that the smart contract is completely secure.",
            8.5
        );

        // =================================================
        // FOOTERS
        // =================================================

        const totalPages =
            pdf.internal.getNumberOfPages();

        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {

            pdf.setPage(page);

            pdf.setFont(
                "helvetica",
                "normal"
            );

            pdf.setFontSize(7.5);

            pdf.setTextColor(
                107,
                114,
                128
            );

            pdf.text(
                `Smart Contract FixGPT | EtherAuthority Internship | Developed by Vasanthi | Page ${page} of ${totalPages}`,
                pageWidth / 2,
                pageHeight - 11,
                {
                    align:
                        "center"
                }
            );

            pdf.setFontSize(6.5);

            pdf.text(
                "GitHub: github.com/mummanavasanthi/smart-contract-fixgpt | LinkedIn: linkedin.com/in/vasanthi-mummana-49bba329/",
                pageWidth / 2,
                pageHeight - 5,
                {
                    align:
                        "center"
                }
            );
        }

        pdf.setTextColor(
            17,
            24,
            39
        );

        // =================================================
        // DOWNLOAD
        // =================================================

        pdf.save(
            "Smart-Contract-FixGPT-Report.pdf"
        );

    } catch (error) {

        console.error(
            "PDF generation failed:",
            error
        );

        alert(
            `Unable to generate PDF: ${
                error?.message ||
                "Unknown error"
            }`
        );
    }
};
// =====================================================
// UI
// =====================================================
    return (
        <div className="app">
            {/* HEADER */}
            <header className="header">
                <div className="header-inner">
                    <div className="header-logo">
                        <div className="header-logo-card">
                            <img
                                src="/etherauthority-logo.png"
                                alt="EtherAuthority"
                            />
                        </div>
                    </div>
                    <div className="header-title">
                        <h1>
                            Smart Contract FixGPT
                        </h1>
                        <p>
                            AI-powered Solidity vulnerability detection and remediation
                        </p>
                    </div>
                    <div className="header-badge">
                        Web3 Security • AI Analysis
                    </div>
                </div>
            </header>
            
            {/* MAIN */}

            <main className="container">


                {/* CONTRACT INPUT */}

                <section className="editor-section">

                    <h2>
                        Solidity Contract
                    </h2>


                    {/* FILE UPLOAD */}

                    <div className="upload-section">

                        <label
                            htmlFor="solidity-file"
                            className="upload-button"
                        >
                            Upload .sol File
                        </label>

                        <input
                            id="solidity-file"
                            type="file"
                            accept=".sol"
                            onChange={
                                handleFileUpload
                            }
                            hidden
                        />


                        {fileName && (
                            <p className="file-name">
                                Selected file:{" "}
                                {fileName}
                            </p>
                        )}

                    </div>


                    <p className="or-text">
                        OR paste Solidity code below
                    </p>


                    {/* CODE */}

                    <textarea
                        value={code}
                        onChange={(e) => {

                            setCode(
                                e.target.value
                            );

                            setFileName("");

                        }}
                        placeholder="Paste your Solidity contract here..."
                    />


                    {/* ANALYZE BUTTON */}

                    <button
                        onClick={
                            analyzeContract
                        }
                        disabled={loading}
                    >
                        {loading
                            ? "Analyzing..."
                            : "Analyze Contract"}
                    </button>


                    {error && (
                        <p className="error">
                            {error}
                        </p>
                    )}

                </section>


                {/* RESULTS */}

                {result && (

                    <section className="results">

                        <h2>
                            Security Results
                        </h2>


                        {/* SECURITY SCORE */}

                        <div
                            className="security-score"
                            style={{
                                "--score": `${securityScore}%`
                            }}
                        >

                            <div className="score-ring">
                                <div className="score-number">
                                    {securityScore}
                                </div>
                            </div>

                            
                        <div className="score-content">
                            <span className="eyebrow">Security Assessment</span>
                            <h3>Security Score</h3>
                            <p>
                                Project-defined score based on weighted Slither findings.
                                Higher-risk findings reduce the score more heavily.
                            </p>
                            <p>
                                <strong>Trust Score:</strong> {trustScore}/100
                            </p>
                            <p>
                                <strong>Status:</strong> {trustStatus}
                            </p>
                        </div>

                        <div className="score-legend">
                            <span><b>{highCount}</b> High</span>
                            <span><b>{mediumCount}</b> Medium</span>
                            <span><b>{lowCount}</b> Low</span>
                            <span><b>{infoCount}</b> Informational</span>
                             <span><b>{optimizationCount}</b> Optimization</span>
                            </div>
                        </div>


                        {/* SUMMARY */}

                        <div className="summary">


                            <div className="summary-card high">
                                <strong>
                                    {highCount}
                                </strong>

                                <span>
                                    High
                                </span>
                            </div>


                            <div className="summary-card medium">
                                <strong>
                                    {mediumCount}
                                </strong>

                                <span>
                                    Medium
                                </span>
                            </div>


                            <div className="summary-card low">
                                <strong>
                                    {lowCount}
                                </strong>

                                <span>
                                    Low
                                </span>
                            </div>


                            <div className="summary-card info">
                                <strong>
                                    {infoCount}
                                </strong>

                                <span>
                                    Informational
                                </span>
                            </div>


                            <div className="summary-card optimization">
                                <strong>
                                    {optimizationCount}
                                </strong>

                                <span>
                                    Optimization
                                </span>
                            </div>


                            <div className="summary-card">
                                <strong>
                                    {
                                        result.original?.count ?? 0
                                    }
                                </strong>

                                <span>
                                    Before
                                </span>
                            </div>


                            <div className="summary-card">
                                <strong>
                                    {
                                        result.reanalysis?.count ?? 0
                                    }
                                </strong>

                                <span>
                                    After
                                </span>
                            </div>


                            <div className="summary-card">
                                <strong>
                                    {
                                        result
                                            .reanalysis
                                            ?.resolved
                                            ?.length ?? 0
                                    }
                                </strong>

                                <span>
                                    Resolved
                                </span>
                            </div>

                        </div>
                        {/* DOWNLOAD REPORT */}
                        
                        <div className="report-buttons">
                            <button
                                className="report-button"
                                onClick={downloadReport}
                            >
                                Download Security Report
                            </button>

                            <button
                                className="report-button excel-button"
                                onClick={downloadExcelReport}
                            >
                                Download Excel Report
                            </button>
                        </div>
                           
                        {/* FINDINGS */}
                        <h3>
                             Security Findings 
                        </h3> 
                        {/* SYNTAX CORRECTION */}

{result.syntaxFix && (
    <section className="fix-section syntax-fix-section">

        <div className="section-header">
            <h2>AI Syntax Correction</h2>

            <button
                className="copy-button"
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(
                            result.syntaxFix.fixedCode
                        );

                        alert("Corrected Solidity code copied!");
                    } catch (err) {
                        setError(
                            "Could not copy the corrected code."
                        );
                    }
                }}
            >
                Copy Corrected Code
            </button>
        </div>

        <p>
            The original Solidity code contained a
            compilation or syntax error. Gemini generated
            a corrected version before security analysis.
        </p>

        <pre>
            {result.syntaxFix.fixedCode}
        </pre>

        {result.syntaxFix.explanation && (
    <div className="syntax-explanation">
        <strong>What was corrected:</strong>

        <p>
            {(() => {
                const explanation =
                    result.syntaxFix.explanation;

                const match = explanation.match(
                    /EXPLANATION:\s*([\s\S]*?)(?:\n\s*FIXED CODE:|$)/i
                );

                return (
                    match
                        ? match[1].trim()
                        : explanation.trim()
                );
            })()}
        </p>
    </div>
)}

    </section>
)}


                        {
                            originalFindings.length === 0
                                ? (

                                    <p className="success">
                                        ✅ No vulnerabilities
                                        detected.
                                    </p>

                                )
                                : (

                                    <div className="findings-list">
                                        {originalFindings.map(
                                            (finding, index) => {

                                                const details =
                                                    getFindingDetails(finding);

                                                const uniqueLines = [
                                                    ...new Set(
                                                        finding.lines || []
                                                    )
                                                ];

                                                return (
                                                    <article
                                                        className={`finding ${finding.severity.toLowerCase()}`}
                                                        key={index}
                                                    >
                                                        <div className="finding-topline">
                                                            <span className={`severity-badge ${finding.severity.toLowerCase()}`}>
                                                                {finding.severity}
                                                            </span>

                                                            <span className="finding-type">
                                                                {finding.severity === "High" || finding.severity === "Medium"
                                                                    ? "Security Vulnerability"
                                                                    : finding.severity === "Optimization"
                                                                    ? "Optimization"
                                                                    : "Informational Finding"}
                                                            </span>
                                                        </div>

                                                        <h3>
                                                            {details.title}
                                                        </h3>

                                                        <div className="finding-meta">
                                                            <span>
                                                                <strong>Confidence:</strong> {finding.confidence || "N/A"}
                                                            </span>

                                                            <span>
                                                                <strong>Function:</strong> {finding.function || "N/A"}
                                                            </span>
                                                        </div>

                                                        <div className="finding-section">
                                                            <h4>Description</h4>
                                                            <p>{finding.description}</p>
                                                        </div>

                                                        <div className="finding-section">
                                                            <h4>Recommendation</h4>
                                                            <p>{details.recommendation}</p>
                                                        </div>

                                                        <div className="finding-section resolution">
                                                            <h4>How to Resolve</h4>
                                                            <p>{details.resolution}</p>
                                                        </div>

                                                        {finding.reference && (
                                                            <details className="slither-reference">
                                                                <summary>Slither Reference</summary>
                                                                <p>{finding.reference}</p>
                                                            </details>
                                                        )}
                                                    </article>
                                                );
                                            }
                                        )}
                                    </div>
                                )
                        }
                        {/* AI ANALYSIS */}

                        {
                            result.ai && (

                                <section
                                    className="ai-section"
                                >
                                    <h2>
                                        AI Security Analysis
                                    </h2>

                                    <pre>
                                        {
                                            result
                                                .ai
                                                .explanation
                                                ?.replace(
                                                    /```solidity[\s\S]*?```/gi,
                                                    ""
                                                )
                                                .trim()
                                        }
                                    </pre>

                                </section>
                            )
                        }
                        {/* AI FIX */}
                        {
                            result.fixedCode && (

                                <section
                                    className="fix-section ai-fix-section"
                                >

                                    <div
                                        className="section-header"
                                    >

                                        <h2>
                                            AI Generated Fix
                                        </h2>
                                        <button
                                            className="copy-button"
                                            onClick={
                                                copyFixedCode
                                            }
                                        >
                                            Copy Fixed Code
                                        </button>

                                    </div>

                                    <pre>
                                        {
                                            result.fixedCode
                                        }
                                    </pre>

                                </section>
                            )
                        }
                        {/* RE-ANALYSIS */}

                        {
                            result.reanalysis && (

                                <section
                                    className="reanalysis"
                                >
                                    <h2>
                                        Re-Analysis
                                    </h2>
                                    {
                                        result
                                            .reanalysis
                                            .resolved
                                            ?.length > 0
                                            ? (
                                                <p className="success">
                                                    ✅ Resolved:{" "}
                                                    {
                                                        result
                                                            .reanalysis
                                                            .resolved
                                                            .join(", ")
                                                    }
                                                </p>

                                            )
                                            : (
                                                <p>
                                                    No vulnerabilities
                                                    were resolved.
                                                </p>
                                            )
                                    }
                                    <h3>
                                        Remaining Findings
                                    </h3>
                                    {
                                        result
                                            .reanalysis
                                            .remaining
                                            ?.length > 0
                                            ? (

                                                result
                                                    .reanalysis
                                                    .remaining
                                                    .map(
                                                        (
                                                            name,
                                                            index
                                                        ) => (

                                                            <p
                                                                key={
                                                                    index
                                                                }
                                                            >
                                                                ⚠️{" "}
                                                                {name}
                                                            </p>

                                                        )
                                                    )

                                            )
                                            : (

                                                <p className="success">
                                                    ✅ No remaining
                                                    findings.
                                                </p>
                                            )
                                    }

                                </section>
                            )
                        }

                    </section>
                )}

            </main>

            <footer className="site-footer">
                <div className="footer-inner">

                    <div className="footer-brand">
                        <div>
                            <strong>Smart Contract FixGPT</strong>
                            <span>Developed by Vasanthi </span>
                        </div>
                    </div>

                    <div className="footer-links">
                        <a
                            href="https://github.com/mummanavasanthi/smart-contract-fixgpt"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="GitHub repository"
                            title="GitHub Repository"
                            className="social-link"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.35-1.76-1.35-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6-.03c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z"/>
                            </svg>
                        </a>

                        <a
                            href="https://www.linkedin.com/in/vasanthi-mummana-49bba3298/"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="LinkedIn profile"
                            title="LinkedIn Profile"
                            className="social-link"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.61 0 4.28 2.38 4.28 5.48v6.26ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM3.56 20.45h3.56V9H3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>
                            </svg>
                        </a>
                    </div>
                </div>

                <p className="footer-note">
                    AI-assisted security analysis • Static analysis by Slither • Review all AI-generated fixes before deployment
                </p>
            </footer>
        </div>
    );
}
export default App;