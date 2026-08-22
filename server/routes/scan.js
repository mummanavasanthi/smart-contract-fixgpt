const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const router = express.Router();

// Project folders
const SECURITY_TOOLS_DIR = path.resolve(
    __dirname,
    "../../security-tools"
);

// Slither executable
const SLITHER_PATH = path.join(
    SECURITY_TOOLS_DIR,
    ".venv",
    "Scripts",
    "slither.exe"
);

// Solidity compiler
const SOLC_PATH = path.join(
    SECURITY_TOOLS_DIR,
    ".venv",
    "Scripts",
    "solc.exe"
);

// Add Solidity compiler to PATH
const env = {
    ...process.env,
    PATH: `${path.dirname(SOLC_PATH)};${process.env.PATH}`
};

// POST /scan
router.post("/", (req, res) => {

    const { code } = req.body;

    // Validate Solidity code
    if (!code || typeof code !== "string") {
        return res.status(400).json({
            success: false,
            message: "Solidity code is required"
        });
    }

    // Create temporary Solidity file
    const fileName = `contract-${Date.now()}.sol`;

    const filePath = path.join(
        SECURITY_TOOLS_DIR,
        fileName
    );

    try {

        // Save Solidity code
        fs.writeFileSync(filePath, code, "utf8");

        console.log("=================================");
        console.log("Starting Slither scan");
        console.log("File:", filePath);
        console.log("Slither:", SLITHER_PATH);
        console.log("Solc:", SOLC_PATH);
        console.log("=================================");

        // Run Slither
  execFile(
    SLITHER_PATH,
    [
        filePath,
        "--json",
        "-"
    ],
    {
        env: env,
        cwd: SECURITY_TOOLS_DIR,
        windowsHide: true
    },
    (error, stdout, stderr) => {

    try {
        fs.unlinkSync(filePath);
    } catch (deleteError) {
        console.log("Could not delete temporary file");
    }

    console.log("Slither scan finished");

    let slitherResult = null;

    try {
        slitherResult = JSON.parse(stdout);
    } catch (parseError) {
        console.log("Could not parse Slither JSON");
    }

    const detectors =
        slitherResult?.results?.detectors || [];

    const findings = detectors.map((detector) => {

        let functionName = null;
        let lines = [];

        for (const element of detector.elements || []) {

            if (
                element.type === "function" &&
                element.name
            ) {
                functionName = element.name;
            }

            if (
                element.source_mapping &&
                element.source_mapping.lines
            ) {
                lines = element.source_mapping.lines;
            }
        }

        return {
            name: detector.check,
            severity: detector.impact,
            confidence: detector.confidence,
            description: detector.description,
            function: functionName,
            lines: lines,
            reference: detector.reference
        };
    });

    res.json({
        success: true,
        scanCompleted: true,
        vulnerabilitiesFound: findings.length > 0,
        count: findings.length,
        findings: findings
    });
    }
);

    } catch (err) {

        // Clean up if something failed
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch {}

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;