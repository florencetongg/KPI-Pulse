require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error('Usage: node check_kpis_as_user.js <userId>');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET not set in backend/.env');
  process.exit(1);
}

(async () => {
  try {
    const token = jwt.sign({ id: USER_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await fetch('http://localhost:3000/api/kpis', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await res.json().catch(() => ({}));
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
