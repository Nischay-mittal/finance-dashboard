const pool = require('../config/db');
const ExcelJS = require('exceljs');

const otcQuery = require('../queries/otcquery');
const patientQuery = require('../queries/patientQuery');


exports.getRevenue = async (req, res) => {
  try {
    console.log('req.body:', req.body);
    const { fromDate, toDate, type } = req.body || {};

    if (!fromDate || !toDate || !type) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    // Mock data for development
    const mockOtcData = [
      { date: '2023-01-01', total_cost: 1000, paid_amount: 950, discount: 50 },
      { date: '2023-01-02', total_cost: 1200, paid_amount: 1100, discount: 100 },
    ];

    const mockPatientData = [
      { date: '2023-01-01', consultation_cost: 500 },
      { date: '2023-01-02', consultation_cost: 600 },
    ];

    let otcData = [];
    let patientData = [];

    // ---------- OTC ----------
    if (type === 'otc' || type === 'combined') {
      // const [rows] = await pool.execute(
      //   otcQuery,
      //   [fromDate, toDate, fromDate, toDate, fromDate, toDate]
      // );
      // otcData = rows;
      otcData = mockOtcData;
    }

    // ---------- PATIENT ----------
    if (type === 'patient' || type === 'combined') {
      // const [rows] = await pool.execute(
      //   patientQuery,
      //   [fromDate, toDate]
      // );
      // patientData = rows;
      patientData = mockPatientData;
    }

    // ---------- COMBINED ----------
    if (type === 'combined') {
      const map = {};

      otcData.forEach(r => {
        map[r.date] = (map[r.date] || 0) + (r.total_cost || 0);
      });

      patientData.forEach(r => {
        map[r.date] = (map[r.date] || 0) + (r.consultation_cost || 0);
      });

      const combined = Object.keys(map).sort().map(date => ({
        date,
        total_revenue: map[date]
      }));

      return res.json({
        type: 'combined',
        fromDate,
        toDate,
        dailyRevenue: combined
      });
    }

    // ---------- SINGLE ----------
    res.json({
      type,
      fromDate,
      toDate,
      dailyRevenue: type === 'otc' ? otcData : patientData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
};

/**
 * =========================
 * EXCEL DOWNLOAD API
 * =========================
 */
exports.downloadRevenueExcel = async (req, res) => {
  try {
    const { fromDate, toDate, type } = req.body;

    if (!fromDate || !toDate || !type) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const workbook = new ExcelJS.Workbook();

    // ---------- OTC SHEET ----------
    if (type === 'otc' || type === 'combined') {
      const [rows] = await pool.execute(
        otcQuery,
        [fromDate, toDate, fromDate, toDate, fromDate, toDate]
      );

      const sheet = workbook.addWorksheet('otc_history');

      if (rows.length > 0) {
        sheet.columns = Object.keys(rows[0]).map(key => ({
          header: key,
          key
        }));
        rows.forEach(r => sheet.addRow(r));
      }
    }

    // ---------- PATIENT SHEET ----------
    if (type === 'patient' || type === 'combined') {
      const [rows] = await pool.execute(
        patientQuery,
        [fromDate, toDate]
      );

      const sheet = workbook.addWorksheet('patient_history');

      if (rows.length > 0) {
        sheet.columns = Object.keys(rows[0]).map(key => ({
          header: key,
          key
        }));
        rows.forEach(r => sheet.addRow(r));
      }
    }

    // ---------- RESPONSE ----------
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=revenue_${type}_${fromDate}_to_${toDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Excel generation failed' });
  }
};




