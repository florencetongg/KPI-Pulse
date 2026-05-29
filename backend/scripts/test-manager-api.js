require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');

const MANAGER_ID = '6a154b1b4f0f9676ea417644';
const KPI_ID = '6a16afa41f233bdd0f87ae96';

async function apiGet(path, token) {
    const res = await fetch(`http://localhost:3000/api${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return { status: res.status, data };
}

async function main() {
    const token = jwt.sign({ id: MANAGER_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const kpis = await apiGet('/kpis', token);
    console.log('GET /kpis:', kpis.status, 'count=', kpis.data.data?.length);

    const feed = await apiGet('/kpi-history/feed', token);
    console.log('GET /kpi-history/feed:', feed.status, 'count=', feed.data.data?.length);

    const cycles = await apiGet(`/kpi-history/${KPI_ID}/cycles`, token);
    console.log('GET /kpi-history/:id/cycles:', cycles.status, 'cycles=', cycles.data.data?.cycles?.length);
    if (cycles.data.message) console.log('  message:', cycles.data.message);
}

main().catch(console.error);
