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
        ? `${path.dirname(SOLC)};${process.env.PATH}`
        : `/usr/local/bin:/opt/slither-venv/bin:${process.env.PATH}`
};
// ===============================
// GEMINI
// ===============================

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// ===============================
// RUN SLITHER
// ===============================

function runSlither(code) {

    return new Promise((resolve, reject) => {

        const fileName = `temp-${Date.now()}.sol`;

        const filePath = path.join(
            SECURITY_TOOLS,
            fileName
        );

        fs.writeFileSync(
            filePath,
            code,
            "utf8"
        );

        execFile(
            SLITHER,
            [filePath, "--json", "-"],
            {
                env: scannerEnv,
                cwd: SECURITY_TOOLS,
                windowsHide: true,
                maxBuffer: 20 * 1024 * 1024
            },
            (error, stdout, stderr) => {

                // Delete temporary file
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                if (!stdout && !stderr) {
                    return reject(
                        new Error(
                            error?.message ||
                            "Slither returned no output"
                        )
                    );
                }

                const output = stdout || stderr;

                try {

                    const result =
                        JSON.parse(output);

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
                                    e =>
                                        e.type === "function"
                                )?.name || null,

                            lines:
                                item.elements?.flatMap(
                                    e =>
                                        e.source_mapping?.lines || []
                                ) || [],

                            reference:
                                item.reference
                        }));

                    resolve(findings);

                } catch (err) {

                    reject(
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

    const match =
        text.match(
            /```solidity\s*([\s\S]*?)```/i
        );

    if (match) {
        return match[1].trim();
    }

    return "";
}

// ===============================
// GEMINI FIX
// ===============================

async function generateFix(code, finding) {

    const prompt = `
You are a Solidity smart contract security expert.

Original Solidity:
${code}

Slither finding:
Detector: ${finding.name}
Severity: ${finding.severity}
Function: ${finding.function || "N/A"}

Description:
${finding.description}

Tasks:

1. Explain the vulnerability.
2. Explain the security impact.
3. Give the recommended remediation.
4. Generate the complete corrected Solidity contract.

Rules:
- Use only the provided Solidity code.
- Do not invent functionality.
- Preserve intended behavior.
- Fix only the reported vulnerability.
- Put the complete corrected contract inside ONE Solidity code block.
- Do not claim the contract is completely secure.
`;

    let response;

try {
    response = await Promise.race([
        ai.models.generateContent({
            model: "gemini-3.7-flash",
            contents: prompt
        }),
        new Promise((_, reject) =>
            setTimeout(
                () => reject(
                    new Error("Gemini request timed out after 60 seconds")
                ),
                60000
            )
        )
    ]);
} catch (error) {
    console.error("Gemini error:", error);

    throw new Error(
        `Gemini AI unavailable: ${error.message}`
    );
}

    const text = response.text;

    return {
        explanation: text,
        fixedCode: extractCode(text)
    };
}

// ===============================
// POST /analyze
// ===============================

router.post("/", async (req, res) => {

    try {

        const { code } = req.body;

        // Validate input
        if (!code || !code.trim()) {

            return res.status(400).json({
                success: false,
                message: "Solidity code is required"
            });
        }

        // ===============================
        // 1. ORIGINAL SCAN
        // ===============================

        const originalFindings =
            await runSlither(code);

        // No findings
        if (originalFindings.length === 0) {

            return res.json({
                success: true,
                message: "No Slither findings detected.",

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
                finding =>
                    finding.severity === "High" ||
                    finding.severity === "Medium"
            );

        const informationalFindings =
            originalFindings.filter(
                finding =>
                    finding.severity === "Informational" ||
                    finding.severity === "Low"
            );

        // ===============================
        // 3. ONLY INFORMATIONAL FINDINGS
        // ===============================

        if (actionableFindings.length === 0) {

            return res.json({

                success: true,

                message:
                    "Only informational findings were detected.",

                original: {
                    count: originalFindings.length,
                    findings: originalFindings
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

        // ===============================
        // 5. GEMINI FIX
        // ===============================

        const aiResult =
            await generateFix(
                code,
                finding
            );

        if (!aiResult.fixedCode) {

            return res.status(500).json({

                success: false,

                message:
                    "Gemini did not return Solidity code.",

                explanation:
                    aiResult.explanation
            });
        }

        // ===============================
        // 6. RE-SCAN FIXED CODE
        // ===============================

        const fixedFindings =
            await runSlither(
                aiResult.fixedCode
            );

        // ===============================
        // 7. COMPARE RESULTS
        // ===============================

        const before =
            new Set(
                originalFindings.map(
                    f => f.name
                )
            );

        const after =
            new Set(
                fixedFindings.map(
                    f => f.name
                )
            );

        const resolved =
            [...before].filter(
                name => !after.has(name)
            );

        const remaining =
            [...after];

        // ===============================
        // 8. RESPONSE
        // ===============================

        res.json({

            success: true,

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

        res.status(500).json({

            success: false,

            message:
                "Analysis failed",

            error:
                error.message
        });
    }
});

module.exports = router;