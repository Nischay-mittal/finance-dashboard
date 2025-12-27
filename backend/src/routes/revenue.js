const express = require('express');
const router = express.Router();

const {
  getRevenue,
  downloadRevenueExcel
} = require('../controllers/revenueController');

// JSON data
router.post('/', getRevenue);

// Excel download
router.post('/excel', downloadRevenueExcel);

module.exports = router;


