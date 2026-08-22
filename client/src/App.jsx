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
                "http://localhost:5000/analyze",
                {
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
                    data.message || "Analysis failed"
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

    const securityScore =
        Math.max(
            0,
            100 -
            (highCount * 30) -
            (mediumCount * 20) -
            (lowCount * 10) -
            (infoCount * 2) -
            (optimizationCount * 1)
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

        // =================================================
        // PDF HELPERS
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
            "AI-Powered Smart Contract Security Report",
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
        // SCORE
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


        // =================================================
        // WORKFLOW
        // =================================================

        heading("Workflow");

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
        // PAGE 2 - FINDINGS
        // =================================================

        addPage();

        heading(
            "Security Findings"
        );

        findings.forEach(
            (finding, index) => {

                ensureSpace(50);

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
                    finding.function ||
                    "N/A"
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

                pdf.setFontSize(
                    8.5
                );

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

                if (
                    finding.reference
                ) {

                    pdf.setFont(
                        "helvetica",
                        "bold"
                    );

                    pdf.setFontSize(
                        8.5
                    );

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

                    pdf.setFontSize(
                        7.5
                    );

                    const refLines =
                        pdf.splitTextToSize(
                            finding.reference,
                            contentWidth
                        );

                    pdf.text(
                        refLines,
                        margin,
                        y
                    );

                    y +=
                        refLines.length *
                        3.8 +
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
                        pageWidth -
                        margin,
                        y
                    );

                    y += 7;
                }
            }
        );


        // =================================================
        // PAGE 3 - AI ANALYSIS
        // =================================================

        addPage();

        heading(
            "AI Security Analysis"
        );

        if (
            result.ai?.explanation
        ) {

            let aiText =
                result.ai.explanation;

            aiText =
                aiText.replace(
                    /###\s*4\.\s*(Complete\s*)?Corrected Solidity (Contract|Code)[\s\S]*$/i,
                    ""
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
                    /^---+$/gm,
                    ""
                );

            aiText =
                aiText.trim();

            paragraph(
                aiText,
                8.7
            );
        }


        // =================================================
        // PAGE 4 - AI FIX
        // =================================================

        addPage();

        heading(
            "AI Generated Fix"
        );

        paragraph(
            "AI-generated remediation proposal. The proposed code was independently re-analyzed using Slither.",
            8.5
        );

        if (
            result.fixedCode
        ) {

            const codeLines =
                result.fixedCode.split(
                    "\n"
                );

            const lineHeight = 4;

            const codeHeight =
                codeLines.length *
                lineHeight +
                12;

            const availableHeight =
                pageHeight -
                y -
                20;

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
                    codeHeight,
                    availableHeight
                ),
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

            let codeY =
                y + 8;

            for (
                let i = 0;
                i < codeLines.length;
                i++
            ) {

                if (
                    codeY >
                    pageHeight - 15
                ) {

                    addPage();

                    heading(
                        "AI Generated Fix - Continued"
                    );

                    pdf.setFillColor(
                        31,
                        41,
                        55
                    );

                    pdf.roundedRect(
                        margin,
                        y,
                        contentWidth,
                        pageHeight -
                        y -
                        20,
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
                        y + 8;
                }

                pdf.text(
                    codeLines[i],
                    margin + 5,
                    codeY
                );

                codeY +=
                    lineHeight;
            }

            pdf.setTextColor(
                17,
                24,
                39
            );
        }


        // =================================================
        // PAGE 5 - RE-ANALYSIS
        // =================================================

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


        // Resolved
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


        // Remaining
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

                    pdf.setFontSize(
                        10
                    );

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

        y += 10;


        // Disclaimer
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
                `Smart Contract FixGPT | Page ${page} of ${totalPages}`,
                pageWidth / 2,
                pageHeight - 8,
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

                <h1>
                    Smart Contract FixGPT
                </h1>

                <p>
                    AI-powered Solidity
                    vulnerability detection
                    and remediation
                </p>

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

                        <div className="security-score">

                            <div className="score-number">
                                {securityScore}
                            </div>

                            <div>
                                <h3>
                                    Security Score
                                </h3>

                                <p>
                                    Based on detected
                                    Slither findings
                                </p>
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


                        {
                            originalFindings.length === 0
                                ? (

                                    <p className="success">
                                        ✅ No vulnerabilities
                                        detected.
                                    </p>

                                )
                                : (

                                    originalFindings.map(
                                        (
                                            finding,
                                            index
                                        ) => (

                                            <div
    className={`finding ${finding.severity.toLowerCase()}`}
    key={index}
>
    <h3>
        {finding.name}
    </h3>

    <p>
        <strong>Type:</strong>{" "}
        {finding.severity === "High" ||
        finding.severity === "Medium"
            ? "Security Vulnerability"
            : finding.severity === "Optimization"
            ? "Optimization"
            : "Informational Finding"}
    </p>

    <p>
        <strong>Severity:</strong>{" "}
        {finding.severity}
    </p>

    <p>
        <strong>Confidence:</strong>{" "}
        {finding.confidence}
    </p>

    <p>
        <strong>Function:</strong>{" "}
        {finding.function || "N/A"}
    </p>

    <p>
        {finding.description}
    </p>
</div>

                                        )
                                    )
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
                                    className="fix-section"
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
        </div>
    );
}

export default App;