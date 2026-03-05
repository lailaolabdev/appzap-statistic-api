/**
 * Update Menu Mappings with New Master Menu Codes
 * 
 * Finds all mappings that reference deleted master menus
 * and updates them with matches from the new master menus.
 * 
 * Run with: node scripts/updateMappingsWithNewCodes.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI_POS_V2 = process.env.MONGODB_URI_POS_V2 || 'mongodb://localhost:27017/appzap_statistic';

async function updateMappingsWithNewCodes() {
    const client = new MongoClient(MONGODB_URI_POS_V2);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db();
        const mappingsCollection = db.collection('menuMappings');
        const masterMenusCollection = db.collection('masterMenus');

        // Load active master menus
        const activeMasterMenus = await masterMenusCollection
            .find({ isDeleted: false })
            .toArray();

        console.log(`📦 Loaded ${activeMasterMenus.length} active master menus`);

        // Build lookup maps
        const masterByCode = new Map();
        const masterByBaseProduct = new Map();

        for (const master of activeMasterMenus) {
            masterByCode.set(master.code, master);

            // Also index by baseProduct + sizeVariant
            if (master.baseProduct && master.sizeVariant) {
                const key = `${master.baseProduct}_${master.sizeVariant}`;
                masterByBaseProduct.set(key, master);
            }
        }

        // Find mappings with old codes (deleted master menus)
        const mappingsWithOldCodes = await mappingsCollection.find({
            masterMenuCode: { $exists: true, $ne: null },
            mappingStatus: { $ne: 'approved' }  // Don't touch approved mappings
        }).toArray();

        console.log(`🔍 Found ${mappingsWithOldCodes.length} mappings to check`);

        let updated = 0;
        let notFound = 0;
        const now = new Date();

        // Import utils for matching
        const { analyzeMenuName, findBestVariantMatch } = require('../src/utils/sizeVariantDetection');

        for (const mapping of mappingsWithOldCodes) {
            // Check if the current masterMenuCode exists in active menus
            if (masterByCode.has(mapping.masterMenuCode)) {
                // Code is valid, skip
                continue;
            }

            // Need to find a new match
            console.log(`\n🔄 Updating mapping for: "${mapping.menuName}"`);
            console.log(`   Old code: ${mapping.masterMenuCode}`);

            // Use variant detection to find the best match
            const analysis = analyzeMenuName(mapping.menuName);

            let newMasterMenu = null;

            if (analysis.product) {
                // Try to find by baseProduct + sizeVariant
                const key = `${analysis.product}_${analysis.sizeVariant || 'bottle_large'}`;
                newMasterMenu = masterByBaseProduct.get(key);

                if (!newMasterMenu) {
                    // Try default variant
                    const defaultKey = `${analysis.product}_bottle_large`;
                    newMasterMenu = masterByBaseProduct.get(defaultKey);
                }

                if (!newMasterMenu) {
                    // Try bottle variant
                    const bottleKey = `${analysis.product}_bottle`;
                    newMasterMenu = masterByBaseProduct.get(bottleKey);
                }
            }

            if (newMasterMenu) {
                console.log(`   New code: ${newMasterMenu.code} (${newMasterMenu.name_en})`);

                // Update the mapping
                await mappingsCollection.updateOne(
                    { _id: mapping._id },
                    {
                        $set: {
                            masterMenuCode: newMasterMenu.code,
                            masterMenuName: newMasterMenu.name,
                            masterMenuName_en: newMasterMenu.name_en,
                            updatedAt: now,
                            suggestedMappings: [{
                                masterMenuCode: newMasterMenu.code,
                                masterMenuName: newMasterMenu.name,
                                masterMenuName_en: newMasterMenu.name_en,
                                confidenceScore: 90,
                                matchType: 'variant_detection'
                            }]
                        }
                    }
                );
                updated++;
            } else {
                console.log(`   ⚠️ No matching master menu found`);
                notFound++;
            }
        }

        console.log(`\n✅ Update complete!`);
        console.log(`   Updated: ${updated}`);
        console.log(`   No match found: ${notFound}`);

    } catch (error) {
        console.error('Error updating mappings:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\nConnection closed.');
    }
}

// Run
updateMappingsWithNewCodes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
