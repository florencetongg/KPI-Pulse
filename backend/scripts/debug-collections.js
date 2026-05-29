require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const managerId = new mongoose.Types.ObjectId('6a154b1b4f0f9676ea417644');

    const sample = await db.collection('kpirecords').findOne({});
    console.log('Sample kpirecord createdBy:', sample?.createdBy, typeof sample?.createdBy);
    console.log('Sample _id:', sample?._id);

    const byOid = await db.collection('kpirecords').countDocuments({ createdBy: managerId });
    const byStr = await db.collection('kpirecords').countDocuments({ createdBy: String(managerId) });
    const total = await db.collection('kpirecords').countDocuments({});
    console.log('Total kpirecords:', total);
    console.log('By ObjectId:', byOid);
    console.log('By string:', byStr);

    const distinctCreatedBy = await db.collection('kpirecords').distinct('createdBy');
    console.log('Distinct createdBy values:', distinctCreatedBy.map(v => ({ v: String(v), type: typeof v })));

    const historyIds = [
        '6a16afa41f233bdd0f87ae96',
        '6a16afe91f233bdd0f87aeaa',
    ];
    for (const id of historyIds) {
        const inKpirecords = await db.collection('kpirecords').findOne({ _id: new mongoose.Types.ObjectId(id) });
        const inKpi = await db.collection('kpi').findOne({ _id: new mongoose.Types.ObjectId(id) });
        console.log(`ID ${id}: kpirecords=${!!inKpirecords}, kpi=${!!inKpi}, createdBy=${inKpirecords?.createdBy || inKpi?.createdBy}`);
    }

    await mongoose.disconnect();
}

main().catch(console.error);
