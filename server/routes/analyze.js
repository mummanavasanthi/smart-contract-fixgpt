const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { GoogleGenerativeAI } = require("@google/generative-ai");
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
                .slice(2, 10)}.sol`;

        const filePath =
            path.join(SECURITY_TOOLS, fileName);

        try {
            fs.writeFileSync(
                filePath,
                code,
                "utf8"
            );
        } catch (error) {
            return reject(
                new Error(
                    `Could not create temporary Solidity file: ${error.message}`
                )
            );
        }

        execFile(
            SLITHER,
            [
                filePath,
                "--json",
                "-"
            ],
            {
                env: {
                    ...scannerEnv,
                    SOLC_VERSION: "0.8.24"
                },
                cwd: SECURITY_TOOLS,
                windowsHide: true,
                maxBuffer: 20 * 1024 * 1024,
                timeout: 60000
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

                console.log("========== SLITHER DEBUG ==========");
                console.log("Exit code:", error?.code);
                console.log("Signal:", error?.signal);
                console.log("Killed:", error?.killed);
                console.log("STDOUT:", stdout || "(empty)");
                console.log("STDERR:", stderr || "(empty)");
                console.log("===================================");

                // First try to parse stdout as Slither JSON.
                // Slither uses --json - to write JSON to stdout.
                if (stdout && stdout.trim()) {
                    try {
                        const result = JSON.parse(stdout);

                        // Slither JSON can report an internal error
                        if (result?.success === false) {
                            return reject(
                                new Error(
                                    result.error ||
                                    "Slither reported an analysis error."
                                )
                            );
                        }

                        const detectors =
                            result?.results?.detectors || [];

                        const findings =
                            detectors.map((item) => ({
                                name: item.check,
                                severity: item.impact,
                                confidence: item.confidence,
                                description: item.description,

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

                        console.log(
                            `Slither completed. Findings: ${findings.length}`
                        );

                        return resolve(findings);

                    } catch (parseError) {
                        console.error(
                            "Could not parse Slither stdout as JSON:",
                            parseError.message
                        );
                    }
                }

                // If JSON was not returned, expose the real process error.
                if (error) {
                    return reject(
                        new Error(
                            [
                                `Slither process failed.`,
                                `Exit code: ${error.code ?? "unknown"}`,
                                `Signal: ${error.signal ?? "none"}`,
                                `STDERR: ${stderr || "(empty)"}`,
                                `STDOUT: ${stdout || "(empty)"}`
                            ].join("\n")
                        )
                    );
                }

                return reject(
                    new Error(
                        "Slither returned no usable output."
                    )
                );
            }
        );
    });
}

// ===============================
// GEMINI FIX
// ===============================

function extractCode(text) {
    if (!text) return null;

    // Try Solidity markdown code block first
    const solidityBlock = text.match(
        /```solidity\s*([\s\S]*?)```/i
    );

    if (solidityBlock) {
        return solidityBlock[1].trim();
    }

    // Try generic markdown code block
    const genericBlock = text.match(
        /```\s*([\s\S]*?)```/
    );

    if (genericBlock) {
        const content = genericBlock[1].trim();

        if (
            content.includes("pragma solidity") ||
            content.includes("contract ")
        ) {
            return content;
        }
    }

    // Fallback: Gemini returned plain Solidity
    const pragmaIndex = text.indexOf("pragma solidity");

    if (pragmaIndex !== -1) {
        return text.substring(pragmaIndex).trim();
    }

    return null;
}

async function generateFix(code, finding) {

    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not configured on the server."
        );
    }

    const prompt = `
You are a Solidity security expert.

Analyze the following vulnerable Solidity contract.

Detected vulnerability:
${finding.name}

Severity:
${finding.severity}

Description:
${finding.description}

Vulnerable Solidity code:

${code}

Your task:
1. Explain the vulnerability briefly.
2. Explain the security impact.
3. Fix the vulnerability.
4. Preserve the original contract functionality.
5. Return the complete corrected Solidity contract.
6. Do not remove existing functions or important functionality.

Return your response in this format:

EXPLANATION:
Brief explanation of the vulnerability and security impact.

FIXED CODE:
Complete corrected Solidity contract.

The corrected contract may be inside a Solidity code block or returned as plain Solidity code.
`;

    const models = [
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.6-flash"
    ];

    const delays = [2000, 4000, 8000];

    let lastError = null;

    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {

        const model = models[modelIndex];

        for (let attempt = 1; attempt <= 2; attempt++) {

            let timeoutId = null;

            try {

                console.log(
                    `Trying Gemini model: ${model}, attempt ${attempt}/2`
                );

                const timeoutPromise = new Promise((_, reject) => {

                    timeoutId = setTimeout(() => {
                        reject(
                            new Error(
                                `Gemini timeout after 20 seconds (${model})`
                            )
                        );
                    }, 20000);
 
                });

                const genAI = new GoogleGenerativeAI(
                    process.env.GEMINI_API_KEY
                );

                const modelClient = genAI.getGenerativeModel({
                    model
                });

                const aiPromise = modelClient.generateContent(prompt);

                const response = await Promise.race([
                    aiPromise,
                    timeoutPromise
                ]);

                const text =
                    response?.response?.text?.() || "";

                if (!text) {
                    throw new Error(
                        "Gemini returned an empty response."
                    );
                }

                console.log(
                    `Gemini response received from ${model}`
                );

                /*
                 * Extract Solidity code.
                 *
                 * First try the existing extractCode() function.
                 * If Gemini did not use a markdown code block,
                 * fall back to detecting the Solidity contract directly.
                 */
                let fixedCode = extractCode(text);

                if (!fixedCode) {

                    const solidityMatch = text.match(
                        /(?:\/\/ SPDX-License-Identifier:[\s\S]*?)?pragma\s+solidity[\s\S]*?contract\s+\w+[\s\S]*/
                    );

                    if (solidityMatch) {
                        fixedCode = solidityMatch[0].trim();
                    }
                }

                if (!fixedCode) {
                    throw new Error(
                        "Gemini returned a response but no corrected Solidity contract could be extracted."
                    );
                }

                console.log(
                    `Gemini success: ${model}`
                );

                return {
                    explanation: text,
                    fixedCode
                };

            } catch (error) {

                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                lastError = error;

                console.error(
                    `Gemini failed (${model}, attempt ${attempt}):`,
                    error.message
                );

                const message =
                    String(error.message || "").toLowerCase();

                const permanentError =
                    message.includes("api key") ||
                    message.includes("authentication") ||
                    message.includes("permission denied") ||
                    message.includes("invalid argument");

                if (permanentError) {
                    break;
                }

                if (attempt === 1) {

                    await new Promise(resolve =>
                        setTimeout(
                            resolve,
                            delays[
                                Math.min(
                                    modelIndex,
                                    delays.length - 1
                                )
                            ]
                        )
                    );

                }

            }
        }
    }

    throw new Error(
        `All Gemini models failed. Last error: ${
            lastError?.message || "Unknown error"
        }`
    );
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