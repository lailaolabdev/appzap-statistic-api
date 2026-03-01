/**
 * Dunning Service (TOR 4 - Payment reminder automation)
 * 
 * T-7, T-1: Pre-billing reminders
 * T+1, T+3: Grace period warnings
 * T+5: Account suspension
 * T+30: Bad debt / Void
 */

const { getUnifiedRestaurants } = require('../utils/multiDbConnection');

async function runDunningChecks(db) {
    const now = new Date();
    const results = { t7: [], t1: [], t1overdue: [], t3: [], t5: [], t30: [] };

    try {
        const unified = await getUnifiedRestaurants({ limit: 10000, skip: 0 });
        
        unified.data.forEach(r => {
            if (!r.endDate) return;
            const endDate = new Date(r.endDate);
            const daysUntil = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            const daysOverdue = -daysUntil;

            const info = { restaurantId: r.restaurantId, posVersion: r.posVersion, name: r.name, phone: r.phone, endDate };

            if (daysUntil === 7) results.t7.push(info);
            if (daysUntil === 1) results.t1.push(info);
            if (daysOverdue === 1) results.t1overdue.push(info);
            if (daysOverdue === 3) results.t3.push(info);
            if (daysOverdue === 5) results.t5.push(info);
            if (daysOverdue >= 30) results.t30.push(info);
        });

        // Update invoice status to overdue for T+1
        await db.collection('invoices').updateMany(
            { paymentStatus: 'pending', dueDate: { $lt: now } },
            { $set: { paymentStatus: 'overdue', updatedAt: now } }
        );

        return results;
    } catch (error) {
        console.error('[Dunning] Error:', error);
        return results;
    }
}

module.exports = { runDunningChecks };
