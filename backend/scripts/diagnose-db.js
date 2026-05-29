require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).sort().join(', '));

    for (const name of ['kpirecords', 'kpirecord', 'kpi', 'kpihistory', 'kpiHistory']) {
        try {
            const count = await db.collection(name).countDocuments();
            if (count) {
                const sample = await db.collection(name).findOne({});
                console.log(`\n[${name}] count=${count}`);
                console.log('  sample keys:', Object.keys(sample || {}));
                if (sample?._id) console.log('  sample _id:', sample._id);
                if (sample?.kpi_id) console.log('  sample kpi_id:', sample.kpi_id);
                if (sample?.createdBy) console.log('  sample createdBy:', sample.createdBy);
                if (sample?.isDeleted !== undefined) console.log('  sample isDeleted:', sample.isDeleted);
            }
        } catch (e) {
            // collection may not exist
        }
    }

    const users = await db.collection('user').find({ role: 'manager' }).limit(3).toArray();
    console.log('\nManagers:', users.map(u => ({ id: u._id, email: u.email, name: u.name })));

    if (users[0]) {
        const mid = users[0]._id;
        for (const kpiColl of ['kpirecords', 'kpi', 'kpirecord']) {
            try {
                const byCreated = await db.collection(kpiColl).countDocuments({ createdBy: mid });
                const byNotDeleted = await db.collection(kpiColl).countDocuments({ isDeleted: { $ne: true } });
                const total = await db.collection(kpiColl).countDocuments({});
                if (total) console.log(`\n${kpiColl} for manager ${users[0].email}: total=${total}, createdBy=${byCreated}, notDeleted=${byNotDeleted}`);
            } catch (e) { /* ignore */ }
        }
        for (const histColl of ['kpihistory', 'kpiHistory']) {
            try {
                const byActor = await db.collection(histColl).countDocuments({ actorId: mid });
                const approved = await db.collection(histColl).countDocuments({ actorId: mid, action: 'approved' });
                const total = await db.collection(histColl).countDocuments({});
                if (total) {
                    console.log(`${histColl}: total=${total}, actorId=manager=${byActor}, approved=${approved}`);
                    const sample = await db.collection(histColl).findOne({ actorId: mid });
                    if (sample) console.log('  sample:', JSON.stringify(sample, null, 2).slice(0, 500));
                }
            } catch (e) { /* ignore */ }
        }
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
