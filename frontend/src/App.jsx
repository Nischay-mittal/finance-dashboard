import { useState } from "react";
import { fetchRevenue, downloadExcel } from "./services/api";
import "./index.css";

export default function App() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [type, setType] = useState("combined");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    try {
      setLoading(true);
      const res = await fetchRevenue({ fromDate, toDate, type });
      console.log("REVENUE DATA:", res);
      setData(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1>Finance Revenue Dashboard</h1>

      <div className="filters">
        <label>
          From Date
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </label>

        <label>
          To Date
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </label>

        <label>
          Revenue Type
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="combined">Combined</option>
            <option value="patient">Patient</option>
            <option value="otc">OTC</option>
          </select>
        </label>

        <div className="buttons">
          <button onClick={handleApply} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>

          <button onClick={() => downloadExcel({ fromDate, toDate, type })}>
            Download Excel
          </button>
        </div>
      </div>

      <div className="output">
        {data.length === 0 ? (
          <p>No data loaded</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td>{row.DATE}</td>
                  <td>{row.TotalRevenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


