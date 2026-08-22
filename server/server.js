require("dotenv").config();

const express = require("express");
const cors = require("cors");

const scanRoute = require("./routes/scan");
const aiRoute = require("./routes/ai");
const analyzeRoute = require("./routes/analyze");

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Smart Contract FixGPT backend is running"
    });
});

app.use("/scan", scanRoute);
app.use("/ai", aiRoute);
app.use("/analyze", analyzeRoute);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});