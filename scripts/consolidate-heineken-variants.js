/**
 * Consolidate Duplicate Heineken Master Menus
 * 
 * Problem: Multiple master menu entries for the same Heineken variant
 * - Old entries with random codes (MENU-G6UHM8T0, MENU-J6HJY113, etc.)
 * - New standardized entries (MENU-HEINEKEN-BOTTLE-LARGE, etc.)
 * 
 * Solution:
 * 1. Identify old master menus by detecting non-standard codes
 * 2. Map them to corresponding new standardized codes
 * 3. Update all menuMappings to use new codes
 * 4. Delete old master menus
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI_POS_V2 = process.env.MONGODB_URI_POS_V2 || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'appzap';

// Mapping from variant characteristics to new standardized codes
const VARIANT_MAPPING = {
    // Large Bottle variants
    'bottle_large': 'MENU-HEINEKEN-BOTTLE-LARGE',
    'ແກ້ວໃຫຍ່': 'MENU-HEINEKEN-BOTTLE-LARGE',
    'large bottle': 'MENU-HEINEKEN-BOTTLE-LARGE',

    // Small Bottle variants
    'bottle_small': 'MENU-HEINEKEN-BOTTLE-SMALL',
    'ແກ້ວນ້ອຍ': 'MENU-HEINEKEN-BOTTLE-SMALL',
    'small bottle': 'MENU-HEINEKEN-BOTTLE-SMALL',

    // Large Can variants
    'can_large': 'MENU-HEINEKEN-CAN-LARGE',
    'ປ໋ອງໃຫຍ່': 'MENU-HEINEKEN-CAN-LARGE',
    '640ml': 'MENU-HEINEKEN-CAN-LARGE',
    'large can': 'MENU-HEINEKEN-CAN-LARGE',

    // Small Can variants
    'can_small': 'MENU-HEINEKEN-CAN-SMALL',
    'ປ໋ອງນ້ອຍ': 'MENU-HEINEKEN-CAN-SMALL',
    '330ml': 'MENU-HEINEKEN-CAN-SMALL',
    'small can': 'MENU-HEINEKEN-CAN-SMALL',

    // Bucket variants
    'bucket': 'MENU-HEINEKEN-BUCKET',
    'ຖັງ': 'MENU-HEINEKEN-BUCKET',
    '12 ແກ້ວ': 'MENU-HEINEKEN-BUCKET',
    '12 bottles': 'MENU-HEINEKEN-BUCKET',

    // Tower variants
    'tower': 'MENU-HEINEKEN-TOWER',
    'ຫໍ': 'MENU-HEINEKEN-TOWER',
    '2.5l': 'MENU-HEINEKEN-TOWER',
    '2.5 l': 'MENU-HEINEKEN-TOWER'
};

async function consolidateHeinekenVariants() {
    const client = new MongoClient(MONGODB_URI_POS_V2);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(DB_NAME);
        const masterMenus = db.collection('masterMenus');
        const menuMappings = db.collection('menuMappings');

        // Step 1: Find all Heineken master menus
        console.log('\n=== Step 1: Finding all Heineken master menus ===');
        const heinekenMenus = await masterMenus.find({
            $or: [
                { baseProduct: 'heineken' },
                { name: /heineken/i },
                { name: /ໄຮເນເກັ້ນ/i },
                { name_en: /heineken/i },
                { code: /HEINEKEN/i }
            ]
        }).toArray();

        console.log(`Found ${heinekenMenus.length} Heineken master menus`);

        // Step 2: Categorize old vs new
        const standardCodes = [
            'MENU-HEINEKEN-BOTTLE-LARGE',
            'MENU-HEINEKEN-BOTTLE-SMALL',
            'MENU-HEINEKEN-CAN-LARGE',
            'MENU-HEINEKEN-CAN-SMALL',
            'MENU-HEINEKEN-BUCKET',
            'MENU-HEINEKEN-TOWER'
        ];

        const oldMenus = heinekenMenus.filter(m => !standardCodes.includes(m.code));
        const newMenus = heinekenMenus.filter(m => standardCodes.includes(m.code));

        console.log(`\n- Standard variants: ${newMenus.length}`);
        console.log(`- Old/duplicate entries: ${oldMenus.length}`);

        if (oldMenus.length === 0) {
            console.log('\n✅ No duplicates found! All Heineken menus are using standard codes.');
            return;
        }

        // Step 3: Create migration mapping
        console.log('\n=== Step 2: Creating migration mapping ===');
        const migrationMap = new Map(); // oldCode -> newCode

        for (const oldMenu of oldMenus) {
            let newCode = null;

            // Try to match by sizeVariant field
            if (oldMenu.sizeVariant && VARIANT_MAPPING[oldMenu.sizeVariant]) {
                newCode = VARIANT_MAPPING[oldMenu.sizeVariant];
            }

            // Try to match by name analysis
            if (!newCode) {
                const nameLower = (oldMenu.name || '').toLowerCase();
                const nameEnLower = (oldMenu.name_en || '').toLowerCase();
                const combined = `${nameLower} ${nameEnLower}`;

                for (const [key, value] of Object.entries(VARIANT_MAPPING)) {
                    if (combined.includes(key.toLowerCase())) {
                        newCode = value;
                        break;
                    }
                }
            }

            // Default to generic if no match
            if (!newCode) {
                console.log(`⚠️  Could not determine variant for: ${oldMenu.code} (${oldMenu.name})`);
                console.log(`   Skipping this entry - requires manual review`);
                continue;
            }

            migrationMap.set(oldMenu.code, newCode);
            console.log(`${oldMenu.code} → ${newCode}`);
        }

        console.log(`\nCreated ${migrationMap.size} migration mappings`);

        // Step 4: Update menuMappings
        console.log('\n=== Step 3: Updating menuMappings ===');
        let updatedMappings = 0;

        for (const [oldCode, newCode] of migrationMap.entries()) {
            const result = await menuMappings.updateMany(
                { masterMenuCode: oldCode },
                {
                    $set: {
                        masterMenuCode: newCode,
                        updatedAt: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`Updated ${result.modifiedCount} mappings: ${oldCode} → ${newCode}`);
                updatedMappings += result.modifiedCount;
            }
        }

        console.log(`\nTotal mappings updated: ${updatedMappings}`);

        // Step 5: Delete old master menus
        console.log('\n=== Step 4: Deleting old master menus ===');
        const oldCodes = Array.from(migrationMap.keys());

        const deleteResult = await masterMenus.deleteMany({
            code: { $in: oldCodes }
        });

        console.log(`Deleted ${deleteResult.deletedCount} old master menu entries`);

        // Step 6: Summary
        console.log('\n=== Summary ===');
        console.log(`✅ Consolidation complete!`);
        console.log(`   - Migrated ${updatedMappings} menu mappings`);
        console.log(`   - Deleted ${deleteResult.deletedCount} duplicate master menus`);
        console.log(`   - Heineken now has ${newMenus.length} standardized variants`);
        console.log('\n⚠️  IMPORTANT: Run "Build Analytics" to update the top selling report!');

    } catch (error) {
        console.error('Error during consolidation:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the script
if (require.main === module) {
    consolidateHeinekenVariants()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { consolidateHeinekenVariants };
