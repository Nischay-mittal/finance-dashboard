import { useMemo, useState } from "react";
import { fetchRevenue } from "./services/api";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [fromDate, setFromDate] = useState("2023-01-01");
  const [toDate, setToDate] = useState("2023-12-31");
  const [type, setType] = useState("combined");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // format date for display and chart axes; strips any time suffix like 18:30:00.000Z
  const formatDate = (value) => {
    if (!value) return "";
    const clean = value.split("T")[0]; // drop time if present
    try {
      return new Date(clean).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return clean;
    }
  };

  // normalize aggregated daily revenue for chart
  const displayRows = useMemo(() => {
    const daily = result?.dailyRevenue || [];
    return daily
      .map((row) => {
        const rawDate = row.date || row.DATE || row.CreatedDate || row.created_at;
        const amount =
          Number(row.total_revenue ?? row.amount ?? row.revenue ?? row.total ?? 0);
        return {
          rawDate,
          date: formatDate(rawDate),
          amount,
        };
      })
      .sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
  }, [result]);

  // desired column orders (match Excel/table format)
  const otcColumns = [
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

  const patientColumns = [
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

  // detail rows/columns
  const detailRows = useMemo(() => {
    if (!result) return [];
    const { type: t, otcRows = [], patientRows = [] } = result;

    if (t === "otc") return otcRows;
    if (t === "patient") return patientRows;

    // combined: tag source and merge
    return [
      ...otcRows.map((r) => ({ ...r, source: "OTC" })),
      ...patientRows.map((r) => ({ ...r, source: "Patient" })),
    ];
  }, [result]);

  const detailColumns = useMemo(() => {
    const { type: t } = result || {};
    if (t === "otc") return otcColumns;
    if (t === "patient") return patientColumns;
    // combined: merge both + source
    return [...new Set([...otcColumns, ...patientColumns, "source"])];
  }, [result]);

  const otcRowsDisplay = useMemo(() => {
    if (!result) return [];
    const { type: t, otcRows = [] } = result;
    return t === "otc" ? otcRows : [];
  }, [result]);

  const patientRowsDisplay = useMemo(() => {
    if (!result) return [];
    const { type: t, patientRows = [] } = result;
    return t === "patient" ? patientRows : [];
  }, [result]);

  // fallback total from detail rows (if API totalRevenue is missing)
  // OTC total = sum PaidAmount; Patient total = sum COST
  const detailTotal = useMemo(() => {
    let sum = 0;
    const clean = (v) => {
      if (v == null) return 0;
      const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    detailRows.forEach((row) => {
      if (row.PaidAmount != null) sum += clean(row.PaidAmount);
      else if (row.COST != null) sum += clean(row.COST);
    });
    return sum;
  }, [detailRows]);

  // total from dailyRevenue (fallback when raw rows are missing)
  const dailyTotal = useMemo(() => {
    const daily = result?.dailyRevenue || [];
    return daily.reduce((acc, r) => {
      const amt = Number(r.total_revenue ?? r.amount ?? 0);
      return acc + (Number.isFinite(amt) ? amt : 0);
    }, 0);
  }, [result]);

  const computedTotal = useMemo(() => {
    const primary = Number(result?.totalRevenue ?? 0);
    // for OTC, prefer explicit sum of PaidAmount if present
    const otcSum = otcRowsDisplay.reduce((acc, r) => {
      const v = r?.PaidAmount;
      if (v == null) return acc;
      const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);

    const patientSum = patientRowsDisplay.reduce((acc, r) => {
      const v = r?.COST;
      if (v == null) return acc;
      const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);

    if (otcSum > 0) return otcSum;
    if (patientSum > 0) return patientSum;
    if (Number.isFinite(primary) && primary > 0) return primary;
    if (detailTotal > 0) return detailTotal;
    if (dailyTotal > 0) return dailyTotal;
    return 0;
  }, [result, detailTotal, dailyTotal, otcRowsDisplay, patientRowsDisplay]);

  const handleApply = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetchRevenue({ from: fromDate, to: toDate, type });
      setResult(res);
    } catch (err) {
      console.log(err);
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <h1>Finance Revenue Dashboard</h1>

      <div className="filters">
        <div>
          <label>From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <label>To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div>
          <label>Revenue Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="combined">Combined</option>
            <option value="otc">OTC</option>
            <option value="patient">Patient</option>
          </select>
        </div>

        <div className="buttons">
          <button onClick={handleApply} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
          <button
            type="button"
            onClick={async () => {
              setError("");
              try {
                const response = await fetch("/api/revenue/excel", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ from: fromDate, to: toDate, type }),
                });
                if (!response.ok) {
                  throw new Error("Failed to download Excel");
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `revenue_${type}_${fromDate}_${toDate}.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error(err);
                setError("Failed to download Excel");
              }
            }}
            disabled={loading}
            style={{ marginLeft: "8px" }}
          >
            Download Excel
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ marginBottom: 4 }}>Summary</h2>
            <p style={{ fontSize: "16px", fontWeight: 500 }}>
              Total revenue ({formatDate(fromDate)} – {formatDate(toDate)}):{" "}
              <span style={{ color: "#007bff" }}>
                ₹ {Number(computedTotal).toLocaleString()}
              </span>
            </p>
          </div>

          <div style={{ height: 320, width: "100%", marginBottom: 24 }}>
            <ResponsiveContainer>
              <LineChart data={displayRows}>
                <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                <Tooltip
                  formatter={(value) => [`₹ ${Number(value).toLocaleString()}`, "Revenue"]}
                  labelFormatter={(label) => label}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Revenue"
                  stroke="#007bff"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {type === "otc" ? (
            <div style={{ overflowX: "auto" }}>
              <h3 style={{ margin: "12px 0 8px" }}>OTC Details</h3>
              <table>
                <thead>
                  <tr>
                    {otcColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {otcRowsDisplay.length === 0 ? (
                    <tr>
                      <td colSpan={otcColumns.length} style={{ textAlign: "center", padding: "12px" }}>
                        No OTC rows returned for this range.
                      </td>
                    </tr>
                  ) : (
                    otcRowsDisplay.map((row, idx) => (
                      <tr key={idx}>
                        {otcColumns.map((col) => {
                          const value = row[col];
                          if (value == null) return <td key={col}></td>;
                          if (col.toLowerCase().includes("date")) {
                            return <td key={col}>{formatDate(String(value))}</td>;
                          }
                          const asNumber =
                            typeof value === "number" ? value : Number(value);
                          if (!Number.isNaN(asNumber) && value !== true && value !== false) {
                            return <td key={col}>{asNumber.toLocaleString()}</td>;
                          }
                          return <td key={col}>{String(value)}</td>;
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : type === "patient" ? (
            <div style={{ overflowX: "auto" }}>
              <h3 style={{ margin: "12px 0 8px" }}>Patient Details</h3>
              <table>
                <thead>
                  <tr>
                    {patientColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patientRowsDisplay.length === 0 ? (
                    <tr>
                      <td colSpan={patientColumns.length} style={{ textAlign: "center", padding: "12px" }}>
                        No Patient rows returned for this range.
                      </td>
                    </tr>
                  ) : (
                    patientRowsDisplay.map((row, idx) => (
                      <tr key={idx}>
                        {patientColumns.map((col) => {
                          const value = row[col];
                          if (value == null) return <td key={col}></td>;
                          if (col.toLowerCase().includes("date")) {
                            return <td key={col}>{formatDate(String(value))}</td>;
                          }
                          const asNumber =
                            typeof value === "number" ? value : Number(value);
                          if (!Number.isNaN(asNumber) && value !== true && value !== false) {
                            return <td key={col}>{asNumber.toLocaleString()}</td>;
                          }
                          return <td key={col}>{String(value)}</td>;
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : detailRows.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    {detailColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row, idx) => (
                    <tr key={idx}>
                      {detailColumns.map((col) => {
                        const value = row[col];
                        if (value == null) return <td key={col}></td>;
                        if (col.toLowerCase().includes("date")) {
                          return <td key={col}>{formatDate(String(value))}</td>;
                        }
                        const asNumber =
                          typeof value === "number"
                            ? value
                            : Number(value);
                        if (!Number.isNaN(asNumber) && value !== true && value !== false) {
                          return <td key={col}>{asNumber.toLocaleString()}</td>;
                        }
                        return <td key={col}>{String(value)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr key={row.rawDate}>
                      <td>{row.date}</td>
                      <td>₹ {row.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;


