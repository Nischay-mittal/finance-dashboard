require('dotenv').config();
const cors = require("cors");


const app = require('./src/app');
app.use(cors());
const pool = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// expose a simple health endpoint to check DB connectivity
app.get('/api/health', async (req, res) => {
  try {
    await pool.testConnection();
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, dbError: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);
  try {
    await pool.testConnection();
    console.log('DB connection: OK');
  } catch (err) {
    console.error('DB connection test failed at startup:', err.message);
  }
});
