/**
 * Delete KPI cycle test rows from 9 June 2026, 6:26 am – 6:54 am (UTC+8).
 * Targets: kpihistory, kpi_cycle_records, and linked evidence metadata.
 *
 * Usage:
 *   node scripts/delete-june-2026-test-cycle.js          # preview only
 *   node scripts/delete-june-2026-test-cycle.js --apply    # delete
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

// 9 June 2026, 6:26 am – 6:54 am Malaysia (UTC+8)
const RANGE_START = new Date('2026-06-08T22:26:00.000Z');
const RANGE_END = new Date('2026-06-08T22:54:59.999Z');

const EVIDENCE_PATTERNS = [
  /UM[_\s]?Logo/i,
  /Evidence_Bug_Fix/i,
  /1780735744553-3d53770b74a0/i,
];

function matchesEvidence(name) {
  const value = String(name || '');
  return EVIDENCE_PATTERNS.some((re) => re.test(value));
}

function inTimeRange(date) {
  const t = new Date(date).getTime();
  return t >= RANGE_START.getTime() && t <= RANGE_END.getTime();
}

function historyMatches(doc) {
  return inTimeRange(doc.recordedAt) && (
    matchesEvidence(doc.evidenceName)
    || ['approved', 'updated', 'submitted'].includes(doc.action)
  );
}

(async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set in backend/.env');

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;

    const historyCol = db.collection('kpihistory');
    const legacyCol = db.collection('kpiHistory');
    const cycleCol = db.collection('kpi_cycle_records');
    const evidenceCol = db.collection('evidence');

    const historyCandidates = await historyCol
      .find({ recordedAt: { $gte: RANGE_START, $lte: RANGE_END } })
      .sort({ recordedAt: 1 })
      .toArray();

    const toDeleteHistory = historyCandidates.filter(historyMatches);

    const legacyCandidates = await legacyCol
      .find({ recordedAt: { $gte: RANGE_START, $lte: RANGE_END } })
      .sort({ recordedAt: 1 })
      .toArray()
      .catch(() => []);

    const toDeleteLegacy = legacyCandidates.filter(historyMatches);

    const cycleCandidates = await cycleCol
      .find({ reviewedAt: { $gte: RANGE_START, $lte: RANGE_END } })
      .sort({ reviewedAt: 1 })
      .toArray();

    const toDeleteCycles = cycleCandidates.filter(
      (doc) => matchesEvidence(doc.evidenceUrl) || inTimeRange(doc.reviewedAt)
    );

    const evidenceCandidates = await evidenceCol
      .find({ createdAt: { $gte: RANGE_START, $lte: RANGE_END } })
      .sort({ createdAt: 1 })
      .toArray();

    const toDeleteEvidence = evidenceCandidates.filter(
      (doc) => matchesEvidence(doc.name) || matchesEvidence(doc.url)
    );

    console.log(`Mode: ${APPLY ? 'DELETE' : 'PREVIEW (pass --apply to delete)'}\n`);
    console.log(`Time window (UTC): ${RANGE_START.toISOString()} → ${RANGE_END.toISOString()}`);
    console.log(`           (UTC+8): 9 June 2026, 6:26 am → 6:54 am\n`);

    const printHistory = (label, docs) => {
      console.log(`--- ${label} (${docs.length}) ---`);
      docs.forEach((doc) => {
        console.log([
          doc._id.toString(),
          doc.action,
          doc.name,
          `${doc.progress ?? 0}%`,
          doc.evidenceName || '—',
          doc.actorRole,
          new Date(doc.recordedAt).toISOString(),
        ].join(' | '));
      });
      console.log('');
    };

    printHistory('kpihistory', toDeleteHistory);
    if (toDeleteLegacy.length) printHistory('kpiHistory (legacy)', toDeleteLegacy);

    console.log(`--- kpi_cycle_records (${toDeleteCycles.length}) ---`);
    toDeleteCycles.forEach((doc) => {
      console.log([
        doc._id.toString(),
        doc.kpiTitle,
        doc.cycleLabel,
        doc.evidenceUrl || '—',
        new Date(doc.reviewedAt).toISOString(),
      ].join(' | '));
    });
    console.log('');

    console.log(`--- evidence (${toDeleteEvidence.length}) ---`);
    toDeleteEvidence.forEach((doc) => {
      console.log([
        doc._id.toString(),
        doc.name,
        doc.url,
        new Date(doc.createdAt).toISOString(),
      ].join(' | '));
    });
    console.log('');

    const total =
      toDeleteHistory.length
      + toDeleteLegacy.length
      + toDeleteCycles.length
      + toDeleteEvidence.length;

    if (!total) {
      console.log('No matching documents found. Try widening the date range or check collection names in Atlas.');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (!APPLY) {
      console.log(`Found ${total} document(s). Re-run with --apply to delete.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const historyIds = toDeleteHistory.map((d) => d._id);
    const legacyIds = toDeleteLegacy.map((d) => d._id);
    const cycleIds = toDeleteCycles.map((d) => d._id);
    const evidenceIds = toDeleteEvidence.map((d) => d._id);

    if (historyIds.length) await historyCol.deleteMany({ _id: { $in: historyIds } });
    if (legacyIds.length) await legacyCol.deleteMany({ _id: { $in: legacyIds } });
    if (cycleIds.length) await cycleCol.deleteMany({ _id: { $in: cycleIds } });
    if (evidenceIds.length) await evidenceCol.deleteMany({ _id: { $in: evidenceIds } });

    console.log('Deleted:');
    console.log(`  kpihistory:         ${historyIds.length}`);
    console.log(`  kpiHistory:         ${legacyIds.length}`);
    console.log(`  kpi_cycle_records:  ${cycleIds.length}`);
    console.log(`  evidence:           ${evidenceIds.length}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
