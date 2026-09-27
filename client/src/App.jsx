import { useState } from "react";
import jsPDF from "jspdf";
import "./App.css";

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
                "Follow the checks-effects-interactions pattern and consider a reentrancy guard for externally callable withdrawal paths.",
            resolution:
                "Update critical state before making the external call, validate the amount, and use ReentrancyGuard where appropriate."
        },
        "reentrancy-no-eth": {
            title: "Reentrancy Vulnerability",
            recommendation:
                "Prevent an external call from re-entering the contract while state is in an inconsistent state.",
            resolution:
                "Apply checks-effects-interactions and use a reentrancy guard when the function can be re-entered."
        },
        "arbitrary-send-eth": {
            title: "Arbitrary ETH Transfer",
            recommendation:
                "Restrict the destination and amount so untrusted input cannot redirect contract funds.",
            resolution:
                "Use access-controlled withdrawal logic and validate recipient addresses and transfer amounts."
        },
        "controlled-delegatecall": {
            title: "Input-Controlled Delegatecall",
            recommendation:
                "Do not allow untrusted users to select the delegatecall target.",
            resolution:
                "Whitelist trusted implementation addresses and protect upgrade or execution functions with strong access control."
        },
        "tx-origin": {
            title: "tx.origin Authentication",
            recommendation:
                "Avoid tx.origin for authorization decisions.",
            resolution:
                "Use msg.sender or a role-based access-control mechanism instead of tx.origin."
        },
        "unchecked-lowlevel": {
            title: "Unchecked Low-Level Call",
            recommendation:
                "Always validate the success flag returned by low-level calls.",
            resolution:
                "Capture the return value from call/delegatecall/send and revert or handle the failure explicitly."
        },
        "missing-zero-check": {
            title: "Missing Zero-Address Check",
            recommendation:
                "Validate addresses before storing or using them.",
            resolution:
                "Reject address(0) for owners, recipients, implementations, and other critical address inputs."
        },
        "low-level-calls": {
            title: "Low-Level Call Usage",
            recommendation:
                "Review low-level calls carefully because they bypass higher-level Solidity safety checks.",
            resolution:
                "Prefer safe abstractions when possible and explicitly validate return values and target addresses."
        },
        "timestamp": {
            title: "Block Timestamp Dependence",
            recommendation:
                "Do not use block.timestamp as a source of strong randomness or precise time guarantees.",
            resolution:
                "Use timestamp only for coarse time-based logic and use an appropriate trusted mechanism for randomness."
        },
        "unprotected-upgrade": {
            title: "Unprotected Upgrade",
            recommendation:
                "Protect upgrade operations with strict authorization.",
            resolution:
                "Use Ownable, AccessControl, or another explicit governance mechanism for upgrades."
        }
    };

    const getFindingDetails = (finding) => {
        return (
            findingGuidance[finding?.name] || {
                title: String(finding?.name || "Security Finding")
                    .replace(/[-_]+/g, " ")
                    .replace(/\b\w/g, (letter) => letter.toUpperCase()),
                recommendation:
                    "Review the detector description and restrict the affected behavior to trusted inputs and authorized callers.",
                resolution:
                    "Apply the mitigation suggested by the detector, retest the contract, and run an independent security review before deployment."
            }
        );
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


    // =====================================================
    // DOWNLOAD SECURITY REPORT
    // =====================================================

 const downloadReport = () => {
    if (!result) {
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
    const contentWidth =
        pageWidth - margin * 2;

    let y = 20;

    // =================================================
    // DATA
    // =================================================

    const findings =
        result.original?.findings || [];

    const resolved =
        result.reanalysis?.resolved || [];

    const remaining =
        result.reanalysis?.remaining || [];

    const syntaxFix =
        result.syntaxFix || null;

    const aiExplanation =
        result.ai?.explanation || "";

    const fixedCode =
        result.fixedCode || "";

    // =================================================
    // PAGE HELPERS
    // =================================================

    const addPage = () => {
        pdf.addPage();
        y = 20;
    };

    const ensureSpace = (height) => {
        if (y + height > pageHeight - 20) {
            addPage();
        }
    };

    const heading = (
        text,
        size = 14
    ) => {
        ensureSpace(12);

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
            text,
            margin,
            y
        );

        y +=
            size >= 14
                ? 9
                : 7;
    };

    const paragraph = (
        text,
        size = 9
    ) => {
        if (!text) {
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

        const height =
            lines.length * 4.4 + 4;

        ensureSpace(height);

        pdf.text(
            lines,
            margin,
            y
        );

        y += height;
    };

    const label = (
        name,
        value
    ) => {
        ensureSpace(6);

        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.setFontSize(9);

        pdf.setTextColor(
            17,
            24,
            39
        );

        pdf.text(
            `${name}:`,
            margin,
            y
        );

        pdf.setFont(
            "helvetica",
            "normal"
        );

        pdf.text(
            String(value),
            margin + 30,
            y
        );

        y += 5.5;
    };

    const codeBlock = (
        code
    ) => {
        if (!code) {
            return;
        }

        const rawLines =
            String(code)
                .replace(/\r\n/g, "\n")
                .split("\n");

        const wrappedLines = [];

        pdf.setFont(
            "courier",
            "normal"
        );

        pdf.setFontSize(7.5);

        rawLines.forEach(
            (line) => {

                const parts =
                    pdf.splitTextToSize(
                        line || " ",
                        contentWidth - 10
                    );

                parts.forEach(
                    (part) => {
                        wrappedLines.push(
                            part
                        );
                    }
                );
            }
        );

        const lineHeight = 3.8;
        const availableHeight =
            pageHeight - y - 20;

        const estimatedHeight =
            wrappedLines.length *
            lineHeight + 12;

        pdf.setFillColor(
            31,
            41,
            55
        );

        pdf.roundedRect(
            margin,
            y,
            contentWidth,
            Math.min(
                estimatedHeight,
                availableHeight
            ),
            3,
            3,
            "F"
        );

        pdf.setTextColor(
            255,
            255,
            255
        );

        let codeY = y + 7;

        for (
            let i = 0;
            i < wrappedLines.length;
            i++
        ) {

            if (
                codeY >
                pageHeight - 15
            ) {

                addPage();

                pdf.setFillColor(
                    31,
                    41,
                    55
                );

                pdf.roundedRect(
                    margin,
                    y,
                    contentWidth,
                    pageHeight - y - 20,
                    3,
                    3,
                    "F"
                );

                pdf.setFont(
                    "courier",
                    "normal"
                );

                pdf.setFontSize(7.5);

                pdf.setTextColor(
                    255,
                    255,
                    255
                );

                codeY =
                    y + 7;
            }

            pdf.text(
                wrappedLines[i],
                margin + 5,
                codeY
            );

            codeY +=
                lineHeight;
        }

        y =
            Math.min(
                y + estimatedHeight,
                pageHeight - 20
            ) + 5;

        pdf.setTextColor(
            17,
            24,
            39
        );
    };

    const extractExplanation = (
        text
    ) => {
        if (!text) {
            return "";
        }

        const match =
            text.match(
                /EXPLANATION:\s*([\s\S]*?)(?:\n\s*FIXED CODE:|$)/i
            );

        return (
            match
                ? match[1].trim()
                : String(text).trim()
        );
    };

    const cleanAIText = (
        text
    ) => {

        if (!text) {
            return "";
        }

        let cleaned =
            String(text);

        cleaned =
            cleaned.replace(
                /###\s*4\.\s*(Complete\s*)?Corrected Solidity (Contract|Code)[\s\S]*$/i,
                ""
            );

        cleaned =
            cleaned.replace(
                /```[\s\S]*?```/g,
                ""
            );

        cleaned =
            cleaned.replace(
                /^#{1,6}\s*/gm,
                ""
            );

        cleaned =
            cleaned.replace(
                /^---+$/gm,
                ""
            );

        return cleaned.trim();
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

    heading(
        "Audit Summary"
    );

    label(
        "Contract",
        fileName ||
        "Pasted Solidity Contract"
    );

    label(
        "Findings Before",
        result.original?.count ?? 0
    );

    label(
        "Findings After",
        result.reanalysis?.count ?? 0
    );

    label(
        "Resolved",
        resolved.length
    );

    y += 5;

    // =================================================
    // SECURITY SCORE
    // =================================================

    ensureSpace(30);

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
        "Project-specific score based on Slither findings",
        margin + 58,
        y + 17
    );

    y += 40;

    // =================================================
    // FINDING SUMMARY
    // =================================================

    heading(
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
                    align: "center"
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
                    align: "center"
                }
            );
        }
    );

    y += 34;

    // =================================================
    // WORKFLOW
    // =================================================

    heading(
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

    paragraph(
        "This report combines Slither static analysis with AI-assisted remediation and independent re-analysis of the proposed fixed contract.",
        9
    );

    // =================================================
    // CLEAN CONTRACT MESSAGE
    // No extra page when there are no findings.
    // =================================================

    if (
        findings.length === 0
    ) {

        heading(
            "Security Findings"
        );

        paragraph(
            "No security findings were detected by Slither."
        );
    }

    // =================================================
    // PAGE 2 - FINDINGS
    // Only create this page if findings exist.
    // =================================================

    if (
        findings.length > 0
    ) {

        addPage();

        heading(
            "Security Findings"
        );

        findings.forEach(
            (finding, index) => {

                ensureSpace(55);

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

                pdf.setFontSize(10.5);

                pdf.text(
                    `${index + 1}. ${finding.name}`,
                    margin + 5,
                    y + 6
                );

                y += 13;

                label(
                    "Severity",
                    finding.severity
                );

                label(
                    "Confidence",
                    finding.confidence
                );

                label(
                    "Function",
                    finding.function || "N/A"
                );

                const uniqueLines = [
                    ...new Set(
                        finding.lines || []
                    )
                ];

                label(
                    "Source Lines",
                    uniqueLines.length
                        ? uniqueLines.join(", ")
                        : "N/A"
                );

                pdf.setFont(
                    "helvetica",
                    "bold"
                );

                pdf.setFontSize(8.5);

                ensureSpace(8);

                pdf.text(
                    "Description",
                    margin,
                    y
                );

                y += 4.5;

                paragraph(
                    finding.description,
                    8.5
                );

                const pdfFindingDetails =
                    getFindingDetails(
                        finding
                    );

                label(
                    "Recommendation",
                    pdfFindingDetails.recommendation
                );

                pdf.setFont(
                    "helvetica",
                    "bold"
                );

                pdf.setFontSize(8.5);

                ensureSpace(8);

                pdf.text(
                    "How to Resolve",
                    margin,
                    y
                );

                y += 4.5;

                paragraph(
                    pdfFindingDetails.resolution,
                    8.5
                );

                if (
                    finding.reference
                ) {

                    pdf.setFont(
                        "helvetica",
                        "bold"
                    );

                    pdf.setFontSize(8.5);

                    ensureSpace(8);

                    pdf.text(
                        "Reference",
                        margin,
                        y
                    );

                    y += 4.5;

                    pdf.setFont(
                        "helvetica",
                        "normal"
                    );

                    pdf.setFontSize(7.5);

                    const refLines =
                        pdf.splitTextToSize(
                            finding.reference,
                            contentWidth
                        );

                    ensureSpace(
                        refLines.length * 3.8 + 5
                    );

                    pdf.text(
                        refLines,
                        margin,
                        y
                    );

                    y +=
                        refLines.length * 3.8 +
                        5;
                }

                if (
                    index <
                    findings.length - 1
                ) {

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
    // AI SYNTAX CORRECTION
    // Only create if syntax repair happened.
    // =================================================

    if (
        syntaxFix?.fixedCode
    ) {

        addPage();

        heading(
            "AI Syntax Correction"
        );

        paragraph(
            "Gemini corrected the compilation or syntax error before security analysis.",
            8.5
        );

        codeBlock(
            syntaxFix.fixedCode
        );

        if (
            syntaxFix.explanation
        ) {

            heading(
                "What Was Corrected"
            );

            paragraph(
                extractExplanation(
                    syntaxFix.explanation
                ),
                8.5
            );
        }
    }

    // =================================================
    // AI SECURITY ANALYSIS
    // Only create if AI analysis exists.
    // =================================================

    if (
        aiExplanation
    ) {

        addPage();

        heading(
            "AI Security Analysis"
        );

        paragraph(
            cleanAIText(
                aiExplanation
            ),
            8.7
        );
    }

    // =================================================
    // AI GENERATED FIX
    // Only create if fixed code exists.
    // =================================================

    if (
        fixedCode
    ) {

        addPage();

        heading(
            "AI Generated Fix"
        );

        paragraph(
            "AI-generated remediation proposal. The proposed code was independently re-analyzed using Slither.",
            8.5
        );

        codeBlock(
            fixedCode
        );
    }

    // =================================================
    // RE-ANALYSIS
    // Only create if re-analysis exists.
    // =================================================

    if (
        result.reanalysis
    ) {

        addPage();

        heading(
            "Re-Analysis Results"
        );

        ensureSpace(25);

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

        // -------------------------------------------------
        // RESOLVED
        // -------------------------------------------------

        heading(
            "Resolved Findings"
        );

        if (
            resolved.length > 0
        ) {

            resolved.forEach(
                (name) => {

                    pdf.setTextColor(
                        22,
                        101,
                        52
                    );

                    pdf.setFont(
                        "helvetica",
                        "bold"
                    );

                    pdf.setFontSize(10);

                    ensureSpace(7);

                    pdf.text(
                        `✓ ${name}`,
                        margin,
                        y
                    );

                    y += 7;
                }
            );

        } else {

            paragraph(
                "No findings were resolved."
            );
        }

        pdf.setTextColor(
            17,
            24,
            39
        );

        y += 6;

        // -------------------------------------------------
        // REMAINING
        // -------------------------------------------------

        heading(
            "Remaining Findings / Review"
        );

        if (
            remaining.length > 0
        ) {

            remaining.forEach(
                (name) => {

                    pdf.setTextColor(
                        146,
                        64,
                        14
                    );

                    pdf.setFont(
                        "helvetica",
                        "bold"
                    );

                    pdf.setFontSize(10);

                    ensureSpace(7);

                    pdf.text(
                        `! ${name}`,
                        margin,
                        y
                    );

                    y += 7;
                }
            );

        } else {

            paragraph(
                "No remaining findings."
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
    // Always present, but never as an empty page.
    // =================================================

    y += 8;

    ensureSpace(35);

    heading(
        "Disclaimer"
    );

    paragraph(
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
                align: "center"
            }
        );

        pdf.setFontSize(6.5);

        pdf.text(
            "GitHub: github.com/mummanavasanthi/smart-contract-fixgpt | LinkedIn: linkedin.com/in/vasanthi-mummana-49bba3298/",
            pageWidth / 2,
            pageHeight - 5,
            {
                align: "center"
            }
        );
    }

    pdf.setTextColor(
        17,
        24,
        39
    );

    // =================================================
    // SAVE
    // =================================================

    pdf.save(
        "Smart-Contract-FixGPT-Report.pdf"
    );
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
                                <h3>
                                    Security Score
                                </h3>

                                <p>
                                    Project-defined score based on weighted Slither findings.
                                    Higher-risk findings reduce the score more heavily.
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

                        <button
                            className="report-button"
                            onClick={
                                downloadReport
                            }
                        >
                            Download Security Report
                        </button>


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