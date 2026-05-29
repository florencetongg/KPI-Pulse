require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Kpi = require('../models/kpi');
const KpiHistory = require('../models/kpiHistory');
const User = require('../models/user');

const NOT_DELETED = { isDeleted: { $ne: true } };

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const managerId = new mongoose.Types.ObjectId('6a154b1b4f0f9676ea417644');

    const user = await User.findById(managerId);
    console.log('User role:', user?.role, user?.email);

    const direct = await Kpi.find({ createdBy: managerId, ...NOT_DELETED }).lean();
    console.log('Direct createdBy query:', direct.length);

    const historyKpiIds = await KpiHistory.distinct('kpi_id', {
        $or: [{ actorId: managerId }, { managerId: managerId }],
    });
    console.log('History kpi ids:', historyKpiIds.length);

    const orConditions = [{ createdBy: managerId }];
    if (historyKpiIds.length) orConditions.push({ _id: { $in: historyKpiIds } });

    const query = { ...NOT_DELETED, $or: orConditions };
    console.log('Query:', JSON.stringify(query));

    const kpis = await Kpi.find(query).lean();
    console.log('Combined query result:', kpis.length, kpis.map(k => k.name));

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
