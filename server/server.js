require("dotenv").config();

const express = require("express");
const cors = require("cors");

const scanRoute = require("./routes/scan");
const aiRoute = require("./routes/ai");
const analyzeRoute = require("./routes/analyze");

const app = express();

const PORT = process.env.PORT || 5000;

// --------------------------------------------------
// CORS
// --------------------------------------------------

const corsOptions = {
    origin: [
        "https://smart-contract-fixgpt.vercel.app",
        "http://localhost:5173"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Explicitly handle browser preflight requests
app.options(/.*/, cors(corsOptions));

app.use(express.json());

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        message: "Smart Contract FixGPT backend is running"
    });
});

// --------------------------------------------------
// ROUTES
// --------------------------------------------------

app.use("/scan", scanRoute);
app.use("/ai", aiRoute);
app.use("/analyze", analyzeRoute);

// --------------------------------------------------
// SERVER
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Server running on port ${PORT}`
    );
});