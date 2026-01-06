const pool = require("../config/db");
const ExcelJS = require("exceljs");


exports.getRevenue = async (req, res) => {
  try {
    console.log('HIT /api/revenue');
    console.log('BODY:', req.body);

    const { from, to, type } = req.body;

    if (!from || !to || !type) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    let otcData = [];
    let patientData = [];

    const toNumber = (val) => {
      if (val == null) return 0;
      const n = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
      return Number.isFinite(n) ? n : 0;
    };

    /* =======================
       OTC REVENUE
    ======================== */
    if (type === 'otc' || type === 'combined') {
      // Detailed OTC revenue query (matches provided PHP logic)
      const otcQuery = `
        SELECT
          patient.PatientId,
          otc_history.OtcId,
          SUBSTR(otc_history.CreatedDate, 1, 10) AS DATE,
          chw.Village,
          otc_history.Cost,
          a.MedicineKP,
          otc_history.PaidAmount,
          Injection AS Others,
          Discount,
          NonPayment,
          d.TestKP,
          division.Name
        FROM otc_history
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Cost) AS MedicineKP,
            SUM(Mrp) AS MedicineMrp,
            SUM(Procurement) AS MedicineProcurement
          FROM prescription
          GROUP BY OtcId
        ) a ON a.OtcId = otc_history.OtcId
        JOIN patient ON patient.PatientId = otc_history.PatientId
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Mrp) AS TestMRP,
            SUM(KC) AS TestProcurement,
            SUM(Cost) AS TestKP
          FROM diagnostic
          GROUP BY OtcId
        ) d ON d.OtcId = otc_history.OtcId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
        ORDER BY otc_history.CreatedDate ASC;
      `;

      const [rows] = await pool.execute(otcQuery, [from, to]);
      otcData = rows;
      console.log(`OTC rows: ${otcData.length}`);
    }

    /* =======================
       PATIENT REVENUE
       (matches PHP logic)
    ======================== */
    if (type === 'patient' || type === 'combined') {
      const patientQuery = `
        SELECT
          patient_history.PatientId,
          patient_history.HistoryId,
          SUBSTR(patient_history.CreatedDate,1,10) AS DATE,
          chw.Village,
          COST,
          (MedicineKP + CorporateKP + MarginKP + MedicineFacilitationKP) AS Medicine,
          ManualFees,
          Adjustment,
          DoctorKP AS Doctor,
          TestKP + InjectionKP + DripKP + NebulizeKP + DressingKP + FacilityKP AS Others,
          reconcilemedicine,
          division.Name
        FROM patient_history
        LEFT JOIN prescription_pricing
          ON prescription_pricing.HistoryId = patient_history.HistoryId
        LEFT JOIN (
          SELECT
            HistoryId,
            ROUND(
              SUM(
                CASE
                  WHEN ReconciledQuantity IS NULL THEN Cost
                  ELSE CAST(ReconciledQuantity*Cost AS DECIMAL)/Quantity
                END
              )
            ) AS reconcilemedicine
          FROM prescription
          GROUP BY HistoryId
        ) b ON b.HistoryId = patient_history.HistoryId
        LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
        LEFT JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE patient_history.CreatedDate BETWEEN ? AND ?
          AND division.Id != 5
        ORDER BY patient_history.CreatedDate ASC;
      `;

      const [rows] = await pool.execute(patientQuery, [from, to]);
      patientData = rows;
      console.log(`Patient rows: ${patientData.length}`);
    }

    /* =======================
       BUILD DAILY + TOTAL REVENUE
       - OTC revenue: use PaidAmount
       - Patient revenue: use COST
    ======================== */
    const totalsByDate = {};
    let totalRevenue = 0;

    const accumulate = (rows, source) => {
      rows.forEach((r) => {
        const date = r.DATE;
        if (!date) return;
        // use PaidAmount for OTC, COST for patient, fallback to 0
        const revenue =
          source === "otc"
            ? toNumber(r.PaidAmount ?? r.Cost)
            : toNumber(r.COST ?? r.Cost);
        if (revenue === 0) return;
        totalsByDate[date] = (totalsByDate[date] || 0) + revenue;
        totalRevenue += revenue;
      });
    };

    if (type === "otc" || type === "combined") {
      accumulate(otcData, "otc");
    }
    if (type === "patient" || type === "combined") {
      accumulate(patientData, "patient");
    }

    const dailyRevenue = Object.keys(totalsByDate)
      .sort()
      .map((date) => ({
        date,
        total_revenue: totalsByDate[date],
      }));

    return res.json({
      type,
      from,
      to,
      totalRevenue,
      dailyRevenue,
      otcRows: otcData,
      patientRows: patientData,
    });

  } catch (err) {
    console.error('REVENUE ERROR:', err);
    res.status(500).json({ message: 'Database error' });
  }
};

// ...existing code...

exports.downloadRevenueExcel = async (req, res) => {
  try {
    const { from, to, type } = req.body;

    let otcData = [];
    let patientData = [];

    if (type === 'otc' || type === 'combined') {
      const otcQuery = `
        SELECT
          patient.PatientId,
          otc_history.OtcId,
          SUBSTR(otc_history.CreatedDate, 1, 10) AS DATE,
          chw.Village,
          otc_history.Cost,
          a.MedicineKP,
          otc_history.PaidAmount,
          Injection AS Others,
          Discount,
          NonPayment,
          d.TestKP,
          division.Name
        FROM otc_history
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Cost) AS MedicineKP,
            SUM(Mrp) AS MedicineMrp,
            SUM(Procurement) AS MedicineProcurement
          FROM prescription
          GROUP BY OtcId
        ) a ON a.OtcId = otc_history.OtcId
        JOIN patient ON patient.PatientId = otc_history.PatientId
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Mrp) AS TestMRP,
            SUM(KC) AS TestProcurement,
            SUM(Cost) AS TestKP
          FROM diagnostic
          GROUP BY OtcId
        ) d ON d.OtcId = otc_history.OtcId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
        ORDER BY otc_history.CreatedDate ASC;
      `;

      const [rows] = await pool.execute(otcQuery, [from, to]);
      otcData = rows;
    }

    if (type === 'patient' || type === 'combined') {
      const patientQuery = `
        SELECT
          patient_history.PatientId,
          patient_history.HistoryId,
          SUBSTR(patient_history.CreatedDate,1,10) AS DATE,
          chw.Village,
          COST,
          (MedicineKP + CorporateKP + MarginKP + MedicineFacilitationKP) AS Medicine,
          ManualFees,
          Adjustment,
          DoctorKP AS Doctor,
          TestKP + InjectionKP + DripKP + NebulizeKP + DressingKP + FacilityKP AS Others,
          reconcilemedicine,
          division.Name
        FROM patient_history
        LEFT JOIN prescription_pricing
          ON prescription_pricing.HistoryId = patient_history.HistoryId
        LEFT JOIN (
          SELECT
            HistoryId,
            ROUND(
              SUM(
                CASE
                  WHEN ReconciledQuantity IS NULL THEN Cost
                  ELSE CAST(ReconciledQuantity*Cost AS DECIMAL)/Quantity
                END
              )
            ) AS reconcilemedicine
          FROM prescription
          GROUP BY HistoryId
        ) b ON b.HistoryId = patient_history.HistoryId
        LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
        LEFT JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE patient_history.CreatedDate BETWEEN ? AND ?
          AND division.Id != 5
        ORDER BY patient_history.CreatedDate ASC;
      `;

      const [rows] = await pool.execute(patientQuery, [from, to]);
      patientData = rows;
    }

    const workbook = new ExcelJS.Workbook();

    // Desired column order (as shown in screenshot)
    const otcHeaders = [
      "PatientId",
      "OtcId",
      "DATE",
      "Village",
      "Cost",
      "MedicineKP",
      "PaidAmount",
      "Others",
      "Discount",
      "NonPayment",
      "TestKP",
      "Name",
    ];

    const patientHeaders = [
      "PatientId",
      "HistoryId",
      "DATE",
      "Village",
      "COST",
      "Medicine",
      "ManualFees",
      "Adjustment",
      "Doctor",
      "Others",
      "reconcilemedicine",
      "Name",
    ];

    // Always create sheets with headers (even if no rows) for consistent format
    const otcSheet = workbook.addWorksheet("otc_history");
    otcSheet.columns = otcHeaders.map((key) => ({ header: key, key }));
    otcData.forEach((row) => {
      const out = {};
      otcHeaders.forEach((k) => (out[k] = row[k] ?? ""));
      otcSheet.addRow(out);
    });

    const patientSheet = workbook.addWorksheet("patient_history");
    patientSheet.columns = patientHeaders.map((key) => ({ header: key, key }));
    patientData.forEach((row) => {
      const out = {};
      patientHeaders.forEach((k) => (out[k] = row[k] ?? ""));
      patientSheet.addRow(out);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=revenue_${type}_${from}_${to}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Excel error:", err);
    res.status(500).json({ message: "Excel generation failed" });
  }
};

