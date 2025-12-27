const express = require('express');
const cors = require('cors');

const revenueRoutes = require('./routes/revenue');

const app = express();

// ✅ allow frontend requests
app.use(cors());

// ✅ allow JSON body
app.use(express.json());

// routes
app.use('/api/revenue', revenueRoutes);

module.exports = app;


