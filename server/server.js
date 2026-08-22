require("dotenv").config();

const express = require("express");
const cors = require("cors");

const scanRoute = require("./routes/scan");
const aiRoute = require("./routes/ai");
const analyzeRoute = require("./routes/analyze");

const app = express();

const PORT = process.env.PORT || 5000;

// Allow the deployed Vercel frontend and local frontend
app.use(
    cors({
        origin: [
            "https://smart-contract-fixgpt.vercel.app",
            "http://localhost:5173"
        ],
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"]
    })
);

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Smart Contract FixGPT backend is running"
    });
});

app.use("/scan", scanRoute);
app.use("/ai", aiRoute);
app.use("/analyze", analyzeRoute);

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Server running on port ${PORT}`
    );
});