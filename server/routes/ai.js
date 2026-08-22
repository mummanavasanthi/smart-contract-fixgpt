const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Extract only Solidity code from Gemini response
function extractSolidityCode(text) {
    if (!text || typeof text !== "string") {
        return "";
    }

    // Case 1: Markdown Solidity code block
    const solidityBlock = text.match(
        /```(?:solidity)?\s*([\s\S]*?)```/i
    );

    if (solidityBlock) {
        return solidityBlock[1].trim();
    }

    // Case 2: Response contains pragma directly
    const pragmaIndex = text.indexOf("pragma solidity");

    if (pragmaIndex !== -1) {
        return text.substring(pragmaIndex).trim();
    }

    return "";
};


// =====================================================
// TEST ROUTE
// =====================================================

router.post("/test", async (req, res) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: "Reply with exactly: Gemini API is working."
        });

        res.json({
            success: true,
            message: response.text
        });

    } catch (error) {
        console.error("Gemini test error:", error);

        res.status(500).json({
            success: false,
            message: "Gemini API request failed",
            error: error.message
        });
    }
});


// =====================================================
// EXPLAIN VULNERABILITY
// =====================================================

router.post("/explain", async (req, res) => {
    try {
        const { code, finding } = req.body;

        if (!code || !finding) {
            return res.status(400).json({
                success: false,
                message: "Solidity code and vulnerability finding are required"
            });
        }

        const prompt = `
You are a smart contract security assistant.

Analyze ONLY the vulnerability detected by Slither.

SOLIDITY CODE:
${code}

SLITHER FINDING:
Detector: ${finding.name}
Severity: ${finding.severity}
Confidence: ${finding.confidence}
Function: ${finding.function || "N/A"}

Description:
${finding.description}

Explain the vulnerability in simple language.

Include:
1. Title
2. Severity
3. Explanation
4. Impact
5. Recommendation

Use only facts supported by the provided Solidity code and Slither finding.
Do not invent functions or variables.
Do not claim that the contract is guaranteed secure.
`;

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt
        });

        res.json({
            success: true,
            explanation: response.text
        });

    } catch (error) {
        console.error("Gemini explanation error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to generate AI explanation",
            error: error.message
        });
    }
});


// =====================================================
// GENERATE FIX
// =====================================================

router.post("/fix", async (req, res) => {
    try {
        const { code, finding } = req.body;

        if (!code || !finding) {
            return res.status(400).json({
                success: false,
                message: "Solidity code and vulnerability finding are required"
            });
        }

        const prompt = `
You are a Solidity smart contract security expert.

Generate a remediation ONLY for the vulnerability reported by Slither.

IMPORTANT RULES:

1. Use ONLY the Solidity code provided below.
2. Do NOT invent functions, variables, contracts, libraries, or APIs.
3. Preserve the original contract's intended behavior.
4. Modify only what is necessary to fix the reported vulnerability.
5. Return the COMPLETE corrected Solidity contract.
6. Put the complete contract inside exactly ONE Solidity code block.
7. Explain what was changed after the code block.
8. Do not claim that the contract is guaranteed secure.

ORIGINAL SOLIDITY CODE:
${code}

SLITHER FINDING:
Detector: ${finding.name}
Severity: ${finding.severity}
Confidence: ${finding.confidence}
Function: ${finding.function || "N/A"}

Description:
${finding.description}

Generate the corrected Solidity contract now.
`;

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt
        });

        const aiText = response.text;

        // Extract Solidity code
        const fixedCode = extractSolidityCode(aiText);

        if (!fixedCode) {
            return res.status(500).json({
                success: false,
                message: "AI response did not contain valid Solidity code",
                explanation: aiText
            });
        }

        res.json({
            success: true,
            fixedCode: fixedCode,
            explanation: aiText
        });

    } catch (error) {
        console.error("Gemini fix error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to generate AI fix",
            error: error.message
        });
    }
});


module.exports = router;