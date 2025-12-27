const BASE_URL = "http://localhost:5000/api"; 
// change port if backend runs on something else

export async function fetchRevenue({ fromDate, toDate, type }) {
  const res = await fetch(`${BASE_URL}/revenue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromDate,
      to: toDate,
      type
    })
  });

  if (!res.ok) {
    throw new Error("Failed to fetch revenue");
  }

  return res.json();
}

export function downloadExcel({ fromDate, toDate, type }) {
  const url = `${BASE_URL}/revenue/excel?from=${fromDate}&to=${toDate}&type=${type}`;
  window.open(url, "_blank");
}


