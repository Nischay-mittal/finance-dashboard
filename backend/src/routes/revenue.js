const express = require("express");
const router = express.Router();
const {
  getRevenue,
  downloadRevenueExcel,
} = require("../controllers/revenueController");

router.post("/", getRevenue);
router.post("/excel", downloadRevenueExcel);

module.exports = router;


