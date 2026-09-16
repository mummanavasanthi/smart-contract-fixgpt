const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile, execFileSync } = require("child_process");
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
    ? "C:\\Users\\vassu\\Desktop\\smart-contract-fixgpt\\security-tools\\.venv\\Scripts\\slither.exe"
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
function detectSolidityVersion(code) {
    const match = code.match(
        /pragma\s+solidity\s+([^;]+);/i
    );

    if (!match) {
        return "0.8.24";
    }

    const pragma = match[1].trim();

    // Exact version: pragma solidity 0.8.20;
    const exact = pragma.match(
        /^(\d+)\.(\d+)\.(\d+)$/
    );

    if (exact) {
        const version = `${exact[1]}.${exact[2]}.${exact[3]}`;

        const installedVersions = [
            "0.4.26",
            "0.5.17",
            "0.6.12",
            "0.7.6",
            "0.8.20",
            "0.8.24",
            "0.8.36"
        ];

        if (installedVersions.includes(version)) {
            return version;
        }

        // If the exact patch version isn't installed,
        // choose a compatible fallback by major.minor.
        const majorMinor =
            `${exact[1]}.${exact[2]}`;

        const fallbackVersions = {
            "0.4": "0.4.26",
            "0.5": "0.5.17",
            "0.6": "0.6.12",
            "0.7": "0.7.6",
            "0.8": "0.8.24"
        };

        return (
            fallbackVersions[majorMinor] ||
            "0.8.24"
        );
    }

    // Version ranges such as ^0.5.0
    if (pragma.includes("0.4.")) {
        return "0.4.26";
    }

    if (pragma.includes("0.5.")) {
        return "0.5.17";
    }

    if (pragma.includes("0.6.")) {
        return "0.6.12";
    }

    if (pragma.includes("0.7.")) {
        return "0.7.6";
    }

    if (pragma.includes("0.8.36")) {
        return "0.8.36";
    }

    if (pragma.includes("0.8.20")) {
        return "0.8.20";
    }

    if (pragma.includes("0.8.24")) {
        return "0.8.24";
    }

    if (pragma.includes("0.8.")) {
        return "0.8.24";
    }

    return "0.8.24";
}

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

        const solidityVersion =
            detectSolidityVersion(code);

        console.log("Received Solidity code:");
console.log(code);
console.log("Detected Solidity version:", solidityVersion);

        console.log(
            `Detected Solidity version: ${solidityVersion}`
        );

        let solcExecutable;

        try {

            if (isWindows) {

    execFileSync(
        "solc-select",
        ["use", solidityVersion],
        {
            windowsHide: true,
            stdio: "ignore"
        }
    );

    solcExecutable =
        "C:\\Python314\\Scripts\\solc.exe";

} else {

    const linuxCompilers = {
        "0.4.26": "/opt/solc-versions/solc-0.4.26",
        "0.5.17": "/opt/solc-versions/solc-0.5.17",
        "0.6.12": "/opt/solc-versions/solc-0.6.12",
        "0.7.6": "/opt/solc-versions/solc-0.7.6",
        "0.8.20": "/opt/solc-versions/solc-0.8.20",
        "0.8.24": "/opt/solc-versions/solc-0.8.24",
        "0.8.36": "/opt/solc-versions/solc-0.8.36"
    };
    solcExecutable =
        linuxCompilers[solidityVersion] ||
        "/opt/solc-versions/solc-0.8.24";
}
        } catch (compilerError) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (_) {}
            return reject(
                new Error(
                    `Could not select Solidity compiler ${solidityVersion}: ${compilerError.message}`
                )
            );
        }

        console.log(
            `Using Solidity compiler: ${solcExecutable}`
        );

        const slitherArgs = [
    filePath,
    "--solc",
    solcExecutable
];

// Add import paths only when the contract contains imports.
if (/\bimport\s+["']/.test(code)) {
    slitherArgs.push(
        "--solc-args",
        "--base-path . --include-path node_modules"
    );
}

slitherArgs.push(
    "--json",
    "-"
);

execFile(
    SLITHER,
    slitherArgs,
            {
                env: {
                    ...scannerEnv
                },

                cwd: path.dirname(filePath),

                windowsHide: true,

                maxBuffer:
                    20 * 1024 * 1024,

                timeout: 60000
            },

            (error, stdout, stderr) => {

                // Always remove temporary file.
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

                console.log(
                    "========== SLITHER DEBUG =========="
                );

                console.log(
                    "Solidity version:",
                    solidityVersion
                );

                console.log(
                    "Compiler:",
                    solcExecutable
                );

                console.log(
                    "Exit code:",
                    error?.code
                );

                console.log(
                    "Signal:",
                    error?.signal
                );

                console.log(
                    "Killed:",
                    error?.killed
                );

                console.log(
                    "STDOUT:",
                    stdout || "(empty)"
                );

                console.log(
                    "STDERR:",
                    stderr || "(empty)"
                );

                console.log(
                    "==================================="
                );

                // Slither JSON output.
                if (stdout && stdout.trim()) {

                    try {

                        const result =
                            JSON.parse(stdout);

                        if (
                            result?.success === false
                        ) {
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

                                severity:
                                    item.impact,

                                confidence:
                                    item.confidence,

                                description:
                                    item.description,

                                function:
                                    item.elements?.find(
                                        (element) =>
                                            element.type ===
                                            "function"
                                    )?.name || null,

                                lines:
                                    item.elements?.flatMap(
                                        (element) =>
                                            element
                                                .source_mapping
                                                ?.lines || []
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

                if (error) {

                    return reject(
                        new Error(
                            [
                                "Slither process failed.",
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
// SOLIDITY COMPILATION CHECK
// ===============================

function compileSolidity(code) {
    return new Promise((resolve, reject) => {

        const fileName =
            `compile-${Date.now()}-${Math.random()
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
                    `Could not create compilation file: ${error.message}`
                )
            );
        }

        const solidityVersion =
            detectSolidityVersion(code);

        let solcExecutable;

        try {

            if (isWindows) {

                execFileSync(
                    "solc-select",
                    ["use", solidityVersion],
                    {
                        windowsHide: true,
                        stdio: "ignore"
                    }
                );

                solcExecutable =
                    "C:\\Python314\\Scripts\\solc.exe";

            } else {

                const linuxCompilers = {
                    "0.4.26": "/opt/solc-versions/solc-0.4.26",
                    "0.5.17": "/opt/solc-versions/solc-0.5.17",
                    "0.6.12": "/opt/solc-versions/solc-0.6.12",
                    "0.7.6": "/opt/solc-versions/solc-0.7.6",
                    "0.8.20": "/opt/solc-versions/solc-0.8.20",
                    "0.8.24": "/opt/solc-versions/solc-0.8.24",
                    "0.8.36": "/opt/solc-versions/solc-0.8.36"
                };

                solcExecutable =
                    linuxCompilers[solidityVersion] ||
                    "/opt/solc-versions/solc-0.8.24";
            }

        } catch (compilerSelectError) {

            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (_) {}

            return reject(
                new Error(
                    `Could not select Solidity compiler ${solidityVersion}: ${compilerSelectError.message}`
                )
            );
        }

        const solcArgs = [
            fileName,
            "--bin"
        ];

        // Support imports such as OpenZeppelin.
        if (/\bimport\s+["']/.test(code)) {
            solcArgs.splice(
                1,
                0,
                "--base-path",
                ".",
                "--include-path",
                "node_modules"
            );
        }

        execFile(
            solcExecutable,
            solcArgs,
            {
                env: {
                    ...scannerEnv
                },

                cwd: SECURITY_TOOLS,

                windowsHide: true,

                maxBuffer:
                    20 * 1024 * 1024,

                timeout: 60000
            },

            (error, stdout, stderr) => {

                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (_) {}

                if (error) {

                    const diagnostics =
                        [
                            stderr,
                            stdout
                        ]
                            .filter(Boolean)
                            .join("\n")
                            .trim();

                    const compilationError =
                        new Error(
                            diagnostics ||
                            `Solidity ${solidityVersion} compilation failed.`
                        );

                    compilationError.isCompilationError = true;
                    compilationError.solidityVersion =
                        solidityVersion;

                    return reject(
                        compilationError
                    );
                }

                resolve({
                    solidityVersion,
                    compiler: solcExecutable
                });
            }
        );
    });
}


// ===============================
// GEMINI SYNTAX REPAIR
// ===============================

async function generateSyntaxFix(
    code,
    diagnostics
) {

    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not configured on the server."
        );
    }

    const prompt = `
You are a Solidity compiler and syntax repair expert.

The following Solidity contract failed compilation.

Compiler diagnostics:
${diagnostics}

Original Solidity code:

${code}

Your task:
1. Identify the syntax or compilation error.
2. Correct the error.
3. Preserve the original contract logic and functionality.
4. Do not add unrelated security changes.
5. Return the complete corrected Solidity contract.

Return your response in this format:

EXPLANATION:
Brief explanation of the compilation error and correction.

FIXED CODE:
Complete corrected Solidity contract.
`;

    const models = [
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.6-flash"
    ];

    let lastError = null;

    for (const model of models) {

        try {

            console.log(
                `Trying Gemini syntax repair model: ${model}`
            );

            const genAI =
                new GoogleGenerativeAI(
                    process.env.GEMINI_API_KEY
                );

            const modelClient =
                genAI.getGenerativeModel({
                    model
                });

            const response =
                await modelClient.generateContent(
                    prompt
                );

            const text =
                response?.response?.text?.() || "";

            if (!text) {
                throw new Error(
                    "Gemini returned an empty syntax-repair response."
                );
            }

            let fixedCode =
                extractCode(text);

            if (!fixedCode) {

                const solidityMatch =
                    text.match(
                        /(?:\/\/ SPDX-License-Identifier:[\s\S]*?)?pragma\s+solidity[\s\S]*?contract\s+\w+[\s\S]*/
                    );

                if (solidityMatch) {
                    fixedCode =
                        solidityMatch[0].trim();
                }
            }

            if (!fixedCode) {
                throw new Error(
                    "Gemini returned no corrected Solidity code."
                );
            }

            // Verify the AI-generated code before continuing.
            await compileSolidity(
                fixedCode
            );

            console.log(
                `Gemini syntax repair success: ${model}`
            );

            return {
                explanation: text,
                fixedCode
            };

        } catch (error) {

            lastError = error;

            console.error(
                `Gemini syntax repair failed (${model}):`,
                error.message
            );
        }
    }

    throw new Error(
        `All Gemini syntax repair attempts failed. Last error: ${
            lastError?.message || "Unknown error"
        }`
    );
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

async function generateFix(analysisCode, finding) {

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
// 1. COMPILE CHECK + SYNTAX REPAIR
// ===============================

let analysisCode = code;
let syntaxFix = null;

try {

    await compileSolidity(
        analysisCode
    );

    console.log(
        "Solidity compilation check passed."
    );

} catch (compileError) {

    if (!compileError.isCompilationError) {
        throw compileError;
    }

    console.warn(
        "Solidity compilation failed. Trying Gemini syntax repair..."
    );

    const syntaxResult =
        await generateSyntaxFix(
            analysisCode,
            compileError.message
        );

    analysisCode =
        syntaxResult.fixedCode;

    syntaxFix = {
        explanation:
            syntaxResult.explanation,
        fixedCode:
            syntaxResult.fixedCode
    };

    console.log(
        "Gemini syntax repair completed and compilation passed."
    );
}


            // ===============================
            // 2. ORIGINAL SCAN
            // ===============================

            console.log(
                "Starting Slither analysis..."
            );

            const originalFindings =
                await runSlither(analysisCode);

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
                reanalysis: null,
                syntaxFix: syntaxFix
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
        syntaxFix
            ? "Syntax error was corrected successfully. No security findings were detected."
            : "No Slither findings detected.",

    original: {
        count: 0,
        findings: []
    },

    actionable: [],
    informational: [],

    ai: null,

    fixedCode: null,

    reanalysis: null,

    syntaxFix: syntaxFix
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
                    analysisCode,
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