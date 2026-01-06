export async function fetchRevenue({ from, to, type }) {
  const response = await fetch("/api/revenue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, type })
  });

  if (!response.ok) {
    console.log(response);
    throw new Error("Failed to fetch data");
  }

  return response.json();
}
