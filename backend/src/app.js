const express = require("express");
const cors = require("cors");

const revenueRoutes = require("./routes/revenue");

const app = express();

app.use(express.json());

app.use(cors());


app.use("/api/revenue", revenueRoutes);

module.exports = app;