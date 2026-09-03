const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

// ===============================
// PATHS
// ===============================

const SECURITY_TOOLS = path.resolve(
    __dirname,
    "../../security-tools"
);

const isWindows =
    process.platform === "win32";

const SLITHER = isWindows
    ? path.join(
        SECURITY_TOOLS,
        ".venv",
        "Scripts",
        "slither.exe"
    )
    : "/opt/slither-venv/bin/slither";

const SOLC = isWindows
    ? path.join(
        SECURITY_TOOLS,
        ".venv",
        "Scripts",
        "solc.exe"
    )
    : "/usr/local/bin/solc";

const scannerEnv = {
    ...process.env,
    PATH: isWindows
        ? `${path.dirname(SOLC)};${process.env.PATH || ""}`
        : `/usr/local/bin:/opt/slither-venv/bin:${process.env.PATH || ""}`
};

// ===============================
// GEMINI
// ===============================

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Use one Gemini model to keep behavior predictable.
const GEMINI_MODEL = "gemini-3.6-flash";

// Maximum time to wait for Gemini.
const GEMINI_TIMEOUT_MS = 15000;

// ===============================
// RUN SLITHER
// ===============================

function runSlither(code) {
    return new Promise((resolve, reject) => {

        const fileName =
            `temp-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}.sol`;

        const filePath = path.join(
            SECURITY_TOOLS,
            fileName
        );

        // Create temporary Solidity file
        try {
            fs.writeFileSync(
                filePath,
                code,
                "utf8"
            );
        } catch (writeError) {
            return reject(writeError);
        }

        execFile(
            SLITHER,
            [
                filePath,
                "--json",
                "-"
            ],
            {
                env: scannerEnv,
                cwd: SECURITY_TOOLS,
                windowsHide: true,
                maxBuffer: 20 * 1024 * 1024
            },
            (error, stdout, stderr) => {

                // Always remove temporary file
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (cleanupError) {
                    console.error(
                        "Temporary file cleanup failed:",
                        cleanupError.message
                    );
                }

                if (!stdout && !stderr) {
                    return reject(
                        new Error(
                            error?.message ||
                            "Slither returned no output"
                        )
                    );
                }

                const output =
                    stdout || stderr;

                try {

                    const result =
                        JSON.parse(output);

                    const detectors =
                        result?.results?.detectors || [];

                    const findings =
                        detectors.map((item) => ({

                            name:
                                item.check,

                            severity:
                                item.impact,

                            confidence:
                                item.confidence,

                            description:
                                item.description,

                            function:
                                item.elements?.find(
                                    (element) =>
                                        element.type === "function"
                                )?.name || null,

                            lines:
                                item.elements?.flatMap(
                                    (element) =>
                                        element.source_mapping?.lines || []
                                ) || [],

                            reference:
                                item.reference
                        }));

                    return resolve(findings);

                } catch (parseError) {

                    console.error(
                        "Slither JSON parse error:",
                        parseError.message
                    );

                    return reject(
                        new Error(
                            "Could not parse Slither JSON"
                        )
                    );
                }
            }
        );
    });
}

// ===============================
// EXTRACT SOLIDITY FROM GEMINI
// ===============================

function extractCode(text) {

    if (!text) {
        return "";
    }

    // Preferred Solidity code block
    const solidityMatch =
        text.match(
            /```solidity\s*([\s\S]*?)```/i
        );

    if (solidityMatch) {
        return solidityMatch[1].trim();
    }

    // Generic code block fallback
    const genericMatch =
        text.match(
            /```\s*([\s\S]*?)```/i
        );

    if (genericMatch) {

        const candidate =
            genericMatch[1].trim();

        if (
            candidate.includes("pragma solidity") ||
            candidate.includes("contract ")
        ) {
            return candidate;
        }
    }

    return "";
}

// ===============================
// GEMINI FIX
// ===============================

async function generateFix(code, finding) {

    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not configured on the server."
        );
    }

    const prompt = `
You are a smart contract security expert.

Analyze the following Solidity vulnerability.

Vulnerability:
${finding.name}

Severity:
${finding.severity}

Description:
${finding.description}

Solidity Code:
${code}

Provide:

1. A simple explanation of the vulnerability.
2. How to fix the vulnerability.
3. The complete corrected Solidity contract.

Return the complete corrected contract inside a Solidity code block.

Do not omit any contract code.
Do not return partial code.
`;

    console.log(
        `Trying Gemini model: ${GEMINI_MODEL}`
    );

    const timeoutPromise =
        new Promise((_, reject) => {

            setTimeout(() => {

                reject(
                    new Error(
                        `Gemini timeout after ${
                            GEMINI_TIMEOUT_MS / 1000
                        } seconds`
                    )
                );

            }, GEMINI_TIMEOUT_MS);
        });

    const aiPromise =
        ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        });

    try {

        const response =
            await Promise.race([
                aiPromise,
                timeoutPromise
            ]);

        const text =
            response?.text || "";

        if (!text.trim()) {

            throw new Error(
                "Gemini returned an empty response."
            );
        }

        const fixedCode =
            extractCode(text);

        if (!fixedCode) {

            throw new Error(
                "Gemini returned an explanation but no Solidity code block."
            );
        }

        console.log(
            "Gemini response received successfully."
        );

        return {
            explanation: text,
            fixedCode: fixedCode
        };

    } catch (error) {

        console.error(
            "Gemini fix generation failed:",
            error.message
        );

        throw error;
    }
}

// ===============================
// POST /analyze
// ===============================

router.post("/", async (req, res) => {

    try {

        const { code } =
            req.body;

        // ===============================
        // VALIDATE INPUT
        // ===============================

        if (!code || !code.trim()) {

            return res.status(400).json({
                success: false,
                message:
                    "Solidity code is required"
            });
        }

        // ===============================
        // 1. ORIGINAL SCAN
        // ===============================

        console.log(
            "Starting Slither analysis..."
        );

        const originalFindings =
            await runSlither(code);

        console.log(
            `Slither completed. Findings: ${originalFindings.length}`
        );

        // ===============================
        // NO FINDINGS
        // ===============================

        if (
            originalFindings.length === 0
        ) {

            return res.json({

                success: true,

                message:
                    "No Slither findings detected.",

                original: {
                    count: 0,
                    findings: []
                },

                actionable: [],
                informational: [],

                ai: null,
                fixedCode: null,
                reanalysis: null
            });
        }

        // ===============================
        // 2. CLASSIFY FINDINGS
        // ===============================

        const actionableFindings =
            originalFindings.filter(
                (finding) =>
                    finding.severity === "High" ||
                    finding.severity === "Medium"
            );

        const informationalFindings =
            originalFindings.filter(
                (finding) =>
                    finding.severity === "Informational" ||
                    finding.severity === "Low"
            );

        // ===============================
        // 3. ONLY INFORMATIONAL FINDINGS
        // ===============================

        if (
            actionableFindings.length === 0
        ) {

            return res.json({

                success: true,

                message:
                    "Only informational findings were detected.",

                original: {
                    count:
                        originalFindings.length,

                    findings:
                        originalFindings
                },

                actionable: [],

                informational:
                    informationalFindings,

                ai: null,

                fixedCode: null,

                reanalysis: null
            });
        }

        // ===============================
        // 4. SELECT PRIMARY FINDING
        // ===============================

        const finding =
            actionableFindings[0];

        console.log(
            `Primary vulnerability: ${finding.name} (${finding.severity})`
        );

        // ===============================
        // 5. GEMINI FIX
        // ===============================

        let aiResult = null;
        let aiError = null;

        try {

            aiResult =
                await generateFix(
                    code,
                    finding
                );

        } catch (error) {

            console.error(
                "Gemini remediation failed:",
                error.message
            );

            aiError =
                error.message;
        }

        // ===============================
        // GEMINI FAILED
        // ===============================

        /*
         * IMPORTANT:
         *
         * Slither detection is still valid even when Gemini
         * is temporarily unavailable.
         *
         * Therefore, do NOT return HTTP 500 here.
         *
         * Return the vulnerability findings normally.
         */

        if (
            !aiResult ||
            !aiResult.fixedCode
        ) {

            console.warn(
                "Gemini unavailable. Returning Slither results only."
            );

            return res.json({

                success: true,

                message:
                    "Security analysis completed. Gemini AI remediation is temporarily unavailable.",

                original: {
                    count:
                        originalFindings.length,

                    findings:
                        originalFindings
                },

                actionable:
                    actionableFindings,

                informational:
                    informationalFindings,

                ai: {

                    vulnerability:
                        finding.name,

                    explanation:
                        "Slither successfully detected the vulnerability, but Gemini could not generate an automated fix at this time.",

                    error:
                        aiError
                },

                fixedCode: null,

                reanalysis: null
            });
        }

        // ===============================
        // 6. RE-SCAN FIXED CODE
        // ===============================

        console.log(
            "Re-analyzing Gemini fixed code..."
        );

        const fixedFindings =
            await runSlither(
                aiResult.fixedCode
            );

        console.log(
            `Re-analysis completed. Findings: ${fixedFindings.length}`
        );

        // ===============================
        // 7. COMPARE RESULTS
        // ===============================

        const before =
            new Set(
                originalFindings.map(
                    (f) => f.name
                )
            );

        const after =
            new Set(
                fixedFindings.map(
                    (f) => f.name
                )
            );

        const resolved =
            [...before].filter(
                (name) =>
                    !after.has(name)
            );

        const remaining =
            [...after];

        // ===============================
        // 8. FINAL RESPONSE
        // ===============================

        return res.json({

            success: true,

            message:
                "Security analysis completed successfully.",

            original: {

                count:
                    originalFindings.length,

                findings:
                    originalFindings
            },

            actionable:
                actionableFindings,

            informational:
                informationalFindings,

            ai: {

                vulnerability:
                    finding.name,

                explanation:
                    aiResult.explanation
            },

            fixedCode:
                aiResult.fixedCode,

            reanalysis: {

                count:
                    fixedFindings.length,

                findings:
                    fixedFindings,

                resolved:
                    resolved,

                remaining:
                    remaining
            }
        });

    } catch (error) {

        console.error(
            "Analyze error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Analysis failed",

            error:
                error.message
        });
    }
});

// ===============================
// EXPORT
// ===============================

module.exports = router;