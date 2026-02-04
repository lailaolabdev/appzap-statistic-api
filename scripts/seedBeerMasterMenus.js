/**
 * Seed Beer & Beverage Master Menus
 * 
 * Creates master menu entries for beer products with all size variants.
 * Run with: node scripts/seedBeerMasterMenus.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appzap_statistic';

// Product definitions with size variants
const PRODUCTS = {
    heineken: {
        name: 'Heineken',
        nameLao: 'ໄຮເນເກັ້ນ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large', 'tower', 'bucket']
    },
    beerlao: {
        name: 'Beer Lao',
        nameLao: 'ເບຍລາວ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large', 'tower', 'bucket']
    },
    beerlao_dark: {
        name: 'Beer Lao Dark',
        nameLao: 'ເບຍລາວດຳ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large']
    },
    carlsberg: {
        name: 'Carlsberg',
        nameLao: 'ຄາລສເບີກ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large', 'tower', 'bucket']
    },
    tiger: {
        name: 'Tiger',
        nameLao: 'ໄທເກີ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large', 'tower', 'bucket']
    },
    singha: {
        name: 'Singha',
        nameLao: 'ສິງຫາ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large']
    },
    chang: {
        name: 'Chang',
        nameLao: 'ຊ້າງ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large']
    },
    leo: {
        name: 'Leo',
        nameLao: 'ລີໂອ',
        category: 'MCAT-BEER',
        variants: ['bottle_large', 'bottle_small', 'can_small', 'can_large']
    },
    pepsi: {
        name: 'Pepsi',
        nameLao: 'ເປັບຊີ',
        category: 'MCAT-SOFTDRINK',
        variants: ['bottle', 'can']
    },
    coke: {
        name: 'Coca-Cola',
        nameLao: 'ໂຄກ',
        category: 'MCAT-SOFTDRINK',
        variants: ['bottle', 'can']
    },
    sprite: {
        name: 'Sprite',
        nameLao: 'ສະໄປຣ໌',
        category: 'MCAT-SOFTDRINK',
        variants: ['bottle', 'can']
    },
    fanta: {
        name: 'Fanta',
        nameLao: 'ແຟັນຕ້າ',
        category: 'MCAT-SOFTDRINK',
        variants: ['bottle', 'can']
    },
    redbull: {
        name: 'Red Bull',
        nameLao: 'ກະທິງແດງ',
        category: 'MCAT-ENERGY',
        variants: ['bottle', 'can']
    },
    m150: {
        name: 'M-150',
        nameLao: 'ເອັມ 150',
        category: 'MCAT-ENERGY',
        variants: ['bottle']
    },
    water: {
        name: 'Drinking Water',
        nameLao: 'ນ້ຳດື່ມ',
        category: 'MCAT-WATER',
        variants: ['500ml', '1500ml', '6l']
    },
    ice: {
        name: 'Ice',
        nameLao: 'ນ້ຳກ້ອນ',
        category: 'MCAT-ICE',
        variants: ['bucket', 'bag']
    }
};

// Size variant definitions
const SIZE_VARIANTS = {
    // Beer bottle sizes
    bottle_large: { name: 'ແກ້ວໃຫຍ່', name_en: 'Large Bottle', mlSize: 640 },
    bottle_small: { name: 'ແກ້ວນ້ອຍ', name_en: 'Small Bottle', mlSize: 330 },
    can_small: { name: 'ປ໋ອງນ້ອຍ 330ml', name_en: 'Small Can 330ml', mlSize: 330 },
    can_large: { name: 'ປ໋ອງໃຫຍ່ 640ml', name_en: 'Large Can 640ml', mlSize: 640 },
    tower: { name: 'ຖັງ 2.5L', name_en: 'Tower 2.5L', mlSize: 2500 },
    bucket: { name: 'ຖັງ 12 ແກ້ວ', name_en: 'Bucket 12 Bottles', count: 12 },

    // Soft drink sizes
    bottle: { name: 'ຂວດ', name_en: 'Bottle', mlSize: 500 },
    can: { name: 'ກະປ໋ອງ', name_en: 'Can', mlSize: 330 },

    // Water sizes
    '500ml': { name: '500ml', name_en: '500ml', mlSize: 500 },
    '1500ml': { name: '1.5L', name_en: '1.5L', mlSize: 1500 },
    '6l': { name: '6L', name_en: '6L', mlSize: 6000 },

    // Ice sizes
    bag: { name: 'ຖົງ', name_en: 'Bag', weight: '2kg' }
};

// Generate unique code
function generateCode(productId, variantId) {
    const prefix = productId.toUpperCase().replace(/_/g, '-');
    const suffix = variantId.toUpperCase().replace(/_/g, '-');
    return `MENU-${prefix}-${suffix}`;
}

async function seedBeerMasterMenus() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db();
        const collection = db.collection('masterMenus');

        const now = new Date();
        const masterMenus = [];

        // Generate master menus for each product and variant
        for (const [productId, product] of Object.entries(PRODUCTS)) {
            for (const variantId of product.variants) {
                const variant = SIZE_VARIANTS[variantId];
                if (!variant) {
                    console.warn(`  ⚠️ Unknown variant: ${variantId}`);
                    continue;
                }

                const code = generateCode(productId, variantId);
                const name = `${product.nameLao} - ${variant.name}`;
                const name_en = `${product.name} - ${variant.name_en}`;

                // Build keywords for matching
                const keywords = [
                    productId,
                    product.name.toLowerCase(),
                    product.nameLao,
                    variantId,
                    variant.name,
                    variant.name_en.toLowerCase()
                ];

                // Add size-specific keywords
                if (variant.mlSize) {
                    keywords.push(`${variant.mlSize}ml`);
                }

                masterMenus.push({
                    code,
                    masterCategoryCode: product.category,
                    name,
                    name_en,
                    name_th: '',
                    name_cn: '',
                    name_kr: '',
                    keywords,
                    description: `${name_en} - Standard beverage product`,
                    description_en: `${name_en} - Standard beverage product`,
                    baseProduct: productId,
                    sizeVariant: variantId,
                    sizeCategory: variantId.split('_')[0],
                    productCategory: product.category,
                    isDefaultVariant: variantId === 'bottle_large' || variantId === 'bottle',
                    imageUrl: '',
                    allergens: [],
                    isVegetarian: false,
                    isVegan: false,
                    isHalal: true,
                    isGlutenFree: true,
                    spiceLevel: 0,
                    prepTimeMinutes: 0,
                    sortOrder: 0,
                    isActive: true,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                });
            }
        }

        console.log(`\n📦 Preparing to seed ${masterMenus.length} master menus...\n`);

        // First, mark old beer-related menus as deleted
        const deleteResult = await collection.updateMany(
            {
                $or: [
                    { baseProduct: { $exists: true } },
                    { code: { $regex: /^MENU-(HEINEKEN|BEERLAO|CARLSBERG|TIGER|SINGHA|CHANG|LEO|PEPSI|COKE|SPRITE|FANTA|REDBULL|M150|WATER|ICE)/i } }
                ]
            },
            {
                $set: {
                    isDeleted: true,
                    deleteReason: 'Replaced by new seed data',
                    deletedAt: now
                }
            }
        );
        console.log(`🗑️  Marked ${deleteResult.modifiedCount} old records as deleted`);

        // Insert new master menus using upsert
        let created = 0;
        let updated = 0;

        for (const menu of masterMenus) {
            // Remove createdAt from menu object to avoid conflict with $setOnInsert
            const { createdAt: _, ...menuData } = menu;

            const result = await collection.updateOne(
                { code: menu.code },
                {
                    $set: menuData,
                    $setOnInsert: { createdAt: now }
                },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                created++;
            } else if (result.modifiedCount > 0) {
                updated++;
            }
        }

        console.log(`\n✅ Seeding complete!`);
        console.log(`   Created: ${created}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Total: ${masterMenus.length}`);

        // Print summary by product
        console.log('\n📋 Products seeded:');
        for (const [productId, product] of Object.entries(PRODUCTS)) {
            console.log(`   - ${product.name} (${product.nameLao}): ${product.variants.length} variants`);
        }

    } catch (error) {
        console.error('Error seeding master menus:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\nConnection closed.');
    }
}

// Run the seed
seedBeerMasterMenus()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
