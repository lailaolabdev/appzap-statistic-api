/**
 * Subscription Management Seeds
 * 
 * Seeds subscription packages and sample WhatsApp templates.
 * 
 * USAGE:
 * node src/seeds/subscriptionSeeds.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const subscriptionPackages = [
    {
        code: 'BASIC',
        name: 'ແພັກເກດພື້ນຖານ',
        nameEnglish: 'Basic Package',
        description: 'ເໝາະສຳລັບຮ້ານຂະໜາດນ້ອຍ',
        monthlyPrice: 99000,
        currency: 'LAK',
        features: [
            { name: 'ຈຳນວນເມນູ', value: '100', included: true },
            { name: 'ຈຳນວນພະນັກງານ', value: '5', included: true },
            { name: 'ຈຳນວນໂຕະ', value: '20', included: true },
            { name: 'ລາຍງານພື້ນຖານ', value: '', included: true },
            { name: 'ລາຍງານຂັ້ນສູງ', value: '', included: false },
        ],
        limits: {
            maxBranches: 1,
            maxUsers: 5,
            maxProducts: 100,
            maxTables: 20,
            maxOrders: -1,
        },
        discountTiers: [
            { months: 6, discountPercent: 10 },
            { months: 12, discountPercent: 20 },
        ],
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        code: 'STANDARD',
        name: 'ແພັກເກດມາດຕະຖານ',
        nameEnglish: 'Standard Package',
        description: 'ເໝາະສຳລັບຮ້ານຂະໜາດກາງ',
        monthlyPrice: 199000,
        currency: 'LAK',
        features: [
            { name: 'ຈຳນວນເມນູ', value: '500', included: true },
            { name: 'ຈຳນວນພະນັກງານ', value: '15', included: true },
            { name: 'ຈຳນວນໂຕະ', value: '50', included: true },
            { name: 'ລາຍງານພື້ນຖານ', value: '', included: true },
            { name: 'ລາຍງານຂັ້ນສູງ', value: '', included: true },
        ],
        limits: {
            maxBranches: 2,
            maxUsers: 15,
            maxProducts: 500,
            maxTables: 50,
            maxOrders: -1,
        },
        discountTiers: [
            { months: 6, discountPercent: 10 },
            { months: 12, discountPercent: 20 },
        ],
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        code: 'PREMIUM',
        name: 'ແພັກເກດພຣີມຽມ',
        nameEnglish: 'Premium Package',
        description: 'ເໝາະສຳລັບຮ້ານຂະໜາດໃຫຍ່',
        monthlyPrice: 399000,
        currency: 'LAK',
        features: [
            { name: 'ຈຳນວນເມນູ', value: 'ບໍ່ຈຳກັດ', included: true },
            { name: 'ຈຳນວນພະນັກງານ', value: 'ບໍ່ຈຳກັດ', included: true },
            { name: 'ຈຳນວນໂຕະ', value: 'ບໍ່ຈຳກັດ', included: true },
            { name: 'ລາຍງານພື້ນຖານ', value: '', included: true },
            { name: 'ລາຍງານຂັ້ນສູງ', value: '', included: true },
            { name: 'ຫຼາຍສາຂາ', value: '5 ສາຂາ', included: true },
        ],
        limits: {
            maxBranches: 5,
            maxUsers: -1,
            maxProducts: -1,
            maxTables: -1,
            maxOrders: -1,
        },
        discountTiers: [
            { months: 6, discountPercent: 15 },
            { months: 12, discountPercent: 25 },
        ],
        isActive: true,
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

const whatsappTemplates = [
    {
        name: 'system_maintenance',
        category: 'maintenance',
        icon: '⚠️',
        subject: 'ແຈ້ງປິດປັບປຸງລະບົບ',
        messageLao: `🔧 ແຈ້ງການສຳຄັນ

ເຖິງລູກຄ້າທີ່ນັບຖື,

AppZap POS ຈະທຳການປິດປັບປຸງລະບົບ
📅 ວັນທີ: {date}
⏰ ເວລາ: {startTime} - {endTime}

ໃນຊ່ວງເວລາດັ່ງກ່າວ ທ່ານຈະບໍ່ສາມາດໃຊ້ງານລະບົບໄດ້ຊົ່ວຄາວ

ຂໍອະໄພໃນຄວາມບໍ່ສະດວກ
AppZap Team 🙏`,
        messageEnglish: `🔧 Important Notice

Dear valued customer,

AppZap POS will undergo system maintenance
📅 Date: {date}
⏰ Time: {startTime} - {endTime}

During this time, the system will be temporarily unavailable.

We apologize for any inconvenience.
AppZap Team 🙏`,
        variables: [
            { name: 'date', description: 'Maintenance date', defaultValue: '' },
            { name: 'startTime', description: 'Start time', defaultValue: '00:00' },
            { name: 'endTime', description: 'End time', defaultValue: '06:00' },
        ],
        quickResponses: [
            { textLao: 'ຮັບຊາບແລ້ວ ຂອບໃຈ', textEnglish: 'Acknowledged, thank you' },
        ],
        isActive: true,
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'payment_reminder',
        category: 'payment',
        icon: '💳',
        subject: 'ແຈ້ງເຕືອນການຊຳລະ',
        messageLao: `💳 ແຈ້ງເຕືອນການຊຳລະ

ເຖິງ {restaurantName},

ໃບແຈ້ງຊຳລະຂອງທ່ານໃກ້ຈະຮອດກຳນົດແລ້ວ
📅 ວັນໝົດກຳນົດ: {dueDate}
💰 ຈຳນວນ: {amount} ກີບ

ກະລຸນາຊຳລະຕາມກຳນົດເວລາ ເພື່ອຫຼີກເວັ້ນການຢຸດບໍລິການ

ຂໍ້ມູນການໂອນ:
🏦 ທະນາຄານ: BCEL
📋 ເລກບັນຊີ: 010-11-00192298
👤 ຊື່ບັນຊີ: LAILAO APPZAP CO.,LTD

AppZap Team`,
        messageEnglish: `💳 Payment Reminder

Dear {restaurantName},

Your invoice is due soon
📅 Due date: {dueDate}
💰 Amount: {amount} LAK

Please make payment by the due date to avoid service interruption.

Bank details:
🏦 Bank: BCEL
📋 Account: 010-11-00192298
👤 Name: LAILAO APPZAP CO.,LTD

AppZap Team`,
        variables: [
            { name: 'restaurantName', description: 'Restaurant name', defaultValue: '' },
            { name: 'dueDate', description: 'Payment due date', defaultValue: '' },
            { name: 'amount', description: 'Amount to pay', defaultValue: '' },
        ],
        quickResponses: [
            { textLao: 'ໂອນແລ້ວ ກະລຸນາກວດສອບ', textEnglish: 'Transferred, please verify' },
            { textLao: 'ຂໍເລື່ອນການຊຳລະ', textEnglish: 'Request payment extension' },
        ],
        isActive: true,
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'subscription_expiry',
        category: 'payment',
        icon: '⏰',
        subject: 'ແຈ້ງເຕືອນໝົດກຳນົດ',
        messageLao: `⏰ ແຈ້ງເຕືອນສຳຄັນ

ເຖິງ {restaurantName},

ແພັກເກດ AppZap POS ຂອງທ່ານຈະໝົດກຳນົດໃນ {daysLeft} ມື້ອີກ
📅 ວັນໝົດກຳນົດ: {expiryDate}

ກະລຸນາຕໍ່ອາຍຸແພັກເກດ ເພື່ອໃຫ້ສາມາດໃຊ້ງານໄດ້ຢ່າງຕໍ່ເນື່ອງ

ຕິດຕໍ່ທີມງານ:
📱 +856-20-5863-5474
📧 info@appzap.la

AppZap Team`,
        messageEnglish: `⏰ Important Reminder

Dear {restaurantName},

Your AppZap POS subscription will expire in {daysLeft} days
📅 Expiry date: {expiryDate}

Please renew your subscription to continue using the service.

Contact us:
📱 +856-20-5863-5474
📧 info@appzap.la

AppZap Team`,
        variables: [
            { name: 'restaurantName', description: 'Restaurant name', defaultValue: '' },
            { name: 'daysLeft', description: 'Days until expiry', defaultValue: '' },
            { name: 'expiryDate', description: 'Expiry date', defaultValue: '' },
        ],
        quickResponses: [
            { textLao: 'ຕ້ອງການຕໍ່ອາຍຸ', textEnglish: 'Want to renew' },
            { textLao: 'ຂໍລາຄາແພັກເກດ', textEnglish: 'Request package prices' },
        ],
        isActive: true,
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'app_update',
        category: 'update',
        icon: '🔄',
        subject: 'ແຈ້ງອັບເດດແອັບ',
        messageLao: `🔄 ແຈ້ງອັບເດດແອັບໃໝ່

ເຖິງລູກຄ້າ AppZap ທຸກທ່ານ,

ພວກເຮົາໄດ້ອອກເວີຊັ່ນໃໝ່ {version} ແລ້ວ!

✨ ຄຸນສົມບັດໃໝ່:
{features}

📲 ກະລຸນາອັບເດດແອັບຂອງທ່ານຜ່ານ:
- App Store (iOS)
- Play Store (Android)

ຫາກມີບັນຫາໃດໆ ກະລຸນາຕິດຕໍ່ພວກເຮົາ
AppZap Team 🚀`,
        messageEnglish: `🔄 New App Update

Dear AppZap customers,

We've released version {version}!

✨ New features:
{features}

📲 Please update your app via:
- App Store (iOS)
- Play Store (Android)

Contact us if you have any issues.
AppZap Team 🚀`,
        variables: [
            { name: 'version', description: 'App version', defaultValue: '1.0.0' },
            { name: 'features', description: 'New features list', defaultValue: '- Bug fixes\n- Performance improvements' },
        ],
        quickResponses: [
            { textLao: 'ອັບເດດແລ້ວ ຂອບໃຈ', textEnglish: 'Updated, thanks' },
            { textLao: 'ມີບັນຫາໃນການອັບເດດ', textEnglish: 'Having update issues' },
        ],
        isActive: true,
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'emergency_notice',
        category: 'emergency',
        icon: '🆘',
        subject: 'ແຈ້ງການສຸກເສີນ',
        messageLao: `🆘 ແຈ້ງການສຸກເສີນ

ເຖິງລູກຄ້າທຸກທ່ານ,

{message}

ຫາກຕ້ອງການຄວາມຊ່ວຍເຫຼືອດ່ວນ:
📱 ສາຍດ່ວນ: +856-20-5863-5474

ຂໍອະໄພໃນຄວາມບໍ່ສະດວກ
AppZap Team`,
        messageEnglish: `🆘 Emergency Notice

Dear customers,

{message}

For urgent assistance:
📱 Hotline: +856-20-5863-5474

We apologize for any inconvenience.
AppZap Team`,
        variables: [
            { name: 'message', description: 'Emergency message', defaultValue: '' },
        ],
        quickResponses: [
            { textLao: 'ຮັບຊາບແລ້ວ', textEnglish: 'Acknowledged' },
            { textLao: 'ຕ້ອງການຄວາມຊ່ວຍເຫຼືອ', textEnglish: 'Need assistance' },
        ],
        isActive: true,
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

async function seedSubscriptionData() {
    let client;
    
    try {
        console.log('Connecting to MongoDB...');
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('AppZap');
        console.log('Connected successfully!\n');

        // Seed subscription packages
        console.log('Seeding subscription packages...');
        for (const pkg of subscriptionPackages) {
            const existing = await db.collection('subscriptionPackages').findOne({ code: pkg.code });
            if (existing) {
                await db.collection('subscriptionPackages').updateOne(
                    { code: pkg.code },
                    { $set: pkg }
                );
                console.log(`  ✓ Updated: ${pkg.code}`);
            } else {
                await db.collection('subscriptionPackages').insertOne(pkg);
                console.log(`  ✓ Created: ${pkg.code}`);
            }
        }

        // Seed WhatsApp templates
        console.log('\nSeeding WhatsApp templates...');
        for (const template of whatsappTemplates) {
            const existing = await db.collection('whatsappTemplates').findOne({ name: template.name });
            if (existing) {
                await db.collection('whatsappTemplates').updateOne(
                    { name: template.name },
                    { $set: template }
                );
                console.log(`  ✓ Updated: ${template.name}`);
            } else {
                await db.collection('whatsappTemplates').insertOne(template);
                console.log(`  ✓ Created: ${template.name}`);
            }
        }

        // Create indexes
        console.log('\nCreating indexes...');
        await db.collection('subscriptionPackages').createIndex({ code: 1 }, { unique: true });
        await db.collection('subscriptionPackages').createIndex({ isActive: 1 });
        await db.collection('whatsappTemplates').createIndex({ name: 1 }, { unique: true });
        await db.collection('whatsappTemplates').createIndex({ category: 1 });
        console.log('  ✓ Indexes created');

        console.log('\n✅ Subscription data seeded successfully!');

    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('Database connection closed.');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    seedSubscriptionData()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { seedSubscriptionData, subscriptionPackages, whatsappTemplates };
