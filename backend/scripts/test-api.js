require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/user');

const TEST_PASSWORDS = ['password123', 'Password123!', 'manager123', '123456', 'admin123'];

async function login(email, password) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return { status: res.status, data };
}

async function apiGet(path, token) {
    const res = await fetch(`http://localhost:3000/api${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return { status: res.status, data };
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const manager = await User.findOne({ email: 'alex.manager@kpipro.com' });
    if (!manager) {
        console.error('Manager not found');
        process.exit(1);
    }

    let password = null;
    for (const candidate of TEST_PASSWORDS) {
        if (await bcrypt.compare(candidate, manager.password)) {
            password = candidate;
            break;
        }
    }

    if (!password) {
        console.error('Could not guess manager password');
        process.exit(1);
    }

    console.log('Using password:', password);

    const loginResult = await login(manager.email, password);
    console.log('Login:', loginResult.status, loginResult.data.success ? 'OK' : loginResult.data.message);
    if (!loginResult.data.token) {
        await mongoose.disconnect();
        return;
    }

    const token = loginResult.data.token;
    const kpis = await apiGet('/kpis', token);
    console.log('GET /kpis:', kpis.status, 'count=', kpis.data.data?.length);
    if (kpis.data.data?.length) {
        console.log('  names:', kpis.data.data.map(k => k.name).join(', '));
    }

    const feed = await apiGet('/kpi-history/feed', token);
    console.log('GET /kpi-history/feed:', feed.status, 'count=', feed.data.data?.length);

    const sampleKpiId = kpis.data.data?.[0]?._id || feed.data.data?.[0]?.kpi_id;
    if (sampleKpiId) {
        const cycles = await apiGet(`/kpi-history/${sampleKpiId}/cycles`, token);
        console.log(`GET /kpi-history/${sampleKpiId}/cycles:`, cycles.status, 'cycles=', cycles.data.data?.cycles?.length);
        if (cycles.data.message) console.log('  message:', cycles.data.message);
    }

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
