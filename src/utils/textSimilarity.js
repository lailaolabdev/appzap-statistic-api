/**
 * Text Similarity Utility - IMPROVED VERSION
 * 
 * Provides robust text matching for Lao, Thai, and English text.
 * Uses multi-strategy matching with category-based filtering.
 * 
 * Key Features:
 * - Proper Unicode handling for Lao (U+0E80-U+0EFF) and Thai (U+0E00-U+0E7F)
 * - Category detection to prevent cross-category false matches
 * - Multi-strategy matching (exact, keyword, token, fuzzy)
 * - Synonym mapping for common items
 * - Learning from approved mappings
 * - Stricter confidence thresholds
 */

// =============================================================================
// SYNONYM MAPPINGS - Items that mean the same thing
// =============================================================================

/**
 * Synonyms map: canonical name -> array of equivalent names
 * Used to match different words/spellings that mean the same thing
 */
const SYNONYM_MAP = {
    // ===== ICE =====
    'ນ້ຳກ້ອນ': [
        'ນ້ຳແຂງ', 'ນໍ້າກ້ອນ', 'ນໍ້າແຂງ', 'ນ້ຳກອນ', 'ນໍ້າກອນ',
        'ice', 'น้ำแข็ง', 'ກ້ອນ', 'ກອນ', 'ນ້ຳກ໊ອນ'
    ],

    // ===== WATER =====
    'ນ້ຳດື່ມ': [
        'ນ້ຳເປົ່າ', 'ນໍ້າດື່ມ', 'ນໍ້າເປົ່າ', 'water', 'น้ำดื่ม', 'น้ำเปล่า', 'ນ້ຳ'
    ],

    // ===== HEINEKEN (COMPREHENSIVE) =====
    'ໄຮເນເກັ້ນ': [
        // English variations
        'heineken', 'heiniken', 'heinekan', 'heiken', 'henekan', 'heneken',
        'heinekn', 'heinekin', 'hieneken', 'heinken', 'heniken',

        // Lao - standard and ໄຊ variations
        'ໄຊເນເກັ້ນ', 'ໄຊເນເກັນ', 'ໄຮເນເກັນ', 'ໄຊເນິເກັນ', 'ໄຮເນີເກັນ', 'ໄຊມີເກັ້ນ',
        'ໄຊເນເກນ', 'ໄຮເນເກນ',

        // ນິ typo variations
        'ໄຊນິເກັ້ນ', 'ໄຊນິເກັນ', 'ໄຮນິເກັ້ນ', 'ໄຮນິເກັນ',
        'ໄຊນິເກນ', 'ໄຮນິເກນ',

        // ນີ variations
        'ໄຮນີເກນ', 'ໄຮນີເກັນ', 'ໄຊນີເກນ', 'ໄຊນີເກັນ',
        'ໄຮນີເກັ້ນ', 'ໄຊນີເກັ້ນ',

        // ລື variations
        'ໄຊລືເກັ້ນ', 'ໄຊລືເກັນ', 'ໄຮລືເກັ້ນ',

        // Other variations
        'ໄຊເນີເກັ້ນ', 'ໄຊເນີເກັນ', 'ຊິເນເກັ້ນ',

        // Double ກ variations (from real data)
        'ໄຮເນັ້ກເກັ້ນ', 'ໄຮເນັກເກັ້ນ', 'ໄຮເນັກເກັນ',
        'ໄຊເນັ້ກເກັ້ນ', 'ໄຊເນັກເກັ້ນ',
        'ໄຮເນັ້ກ', 'ໄຮເນັກ', 'ໄຮເນັກກ',
        'ໄຊເນັ້ກ', 'ໄຊເນັກ',

        // Short forms / abbreviations
        'ໄຮເກັ້ນ', 'ໄຊເກັ້ນ', 'ໄຮເກັນ', 'ໄຊເກັນ',
        'ໄຮເກນ', 'ໄຊເກນ',

        // With ເບຍ prefix
        'ເບຍໄຮ', 'ເບຍໄຊ', 'ເບຍheineken', 'ເບຍheiniken',
        'ເບຍໄຊເນເກັ້ນ', 'ເບຍໄຊນິເກັ້ນ', 'ເບຍໄຮເນເກັ້ນ',
        'ເບຍໄຮເນັ້ກ', 'ເບຍໄຊເນັ້ກ',

        // Pairs/sets
        'ຄູ່ຂອງheineken', 'ຄູ່heineken', 'ຄູ່ໄຊເນເກັ້ນ', 'ຄູ່ໄຮເນເກັ້ນ'
    ],

    // ===== BEER LAO (COMPREHENSIVE) =====
    'ເບຍລາວ': [
        // English
        'beer lao', 'beerlao', 'lao beer', 'laobeer', 'beer laos',

        // Lao variations
        'ເບຍ ລາວ', 'ເບຍ-ລາວ',

        // Variants (Original, New, Dark)
        'ເບຍລາວເດີມ', 'ເບຍລາວໃໝ່', 'ເບຍລາວໃຫມ່', 'ເບຍລາວດຳ', 'ເບຍລາວຂາວ',
        'ລາວເດີມ', 'ລາວໃໝ່', 'ລາວດຳ', 'ລາວຂາວ',

        // Dark beer specific
        'ເບຍດຳ', 'ເບຍ ດຳ', 'dark lao',

        // Abbreviations
        'ບລ', 'ບ.ລ', 'ບລວ'
    ],

    // ===== CARLSBERG (COMPREHENSIVE) =====
    'ຄາລສເບີກ': [
        // English variations
        'carlsberg', 'carlberg', 'carsberg', 'carlburg', 'carlsbirg',
        'calsberg', 'karlsberg', 'karlberg',

        // Lao variations
        'ຄາລເບີກ', 'ຄາສເບີກ', 'ຄາລສເບັກ',
        'ຄາລເບິກ', 'ຄານເບີກ', 'ຄາລສະເບີກ',
        'ກາລສເບີກ', 'ກາລເບີກ',

        // Without tone marks
        'ຄາລສເບກ', 'ຄາລເບກ', 'ຄາສເບກ',

        // With ເບຍ prefix
        'ເບຍຄາລສເບີກ', 'ເບຍຄາລເບີກ', 'ເບຍຄາສເບີກ',
        'ເບຍcarlsberg', 'ເບຍcarlberg'
    ],

    // ===== TIGER (COMPREHENSIVE) =====
    'ໄທເກີ': [
        // English
        'tiger', 'tiger beer', 'tigerbeer',

        // Lao variations
        'ໄທເກີ້', 'ໄຕເກີ', 'ໄຕເກີ້',
        'ໄທເກ', 'ໄຕເກ',
        'ທາຍເກີ', 'ທາຍເກີ້',

        // With ເບຍ prefix
        'ເບຍໄທເກີ', 'ເບຍໄຕເກີ', 'ເບຍtiger',
        'ເບຍໄທເກີ້'
    ],

    // ===== SINGHA =====
    'ສິງ': [
        'singha', 'singh', 'singa',
        'ສິງຫາ', 'ສີງ', 'ສີງຫາ',
        'ເບຍສິງ', 'ເບຍສິງຫາ', 'ເບຍsingha'
    ],

    // ===== CHANG =====
    'ຊ້າງ': [
        'chang', 'chang beer',
        'ຊາງ', 'ຊ໋າງ',
        'ເບຍຊ້າງ', 'ເບຍຊາງ', 'ເບຍchang'
    ],

    // ===== LEO =====
    'ລີໂອ': [
        'leo', 'leo beer',
        'ລິໂອ', 'ລິໂອ້', 'ລີໂອ້',
        'ເບຍລີໂອ', 'ເບຍລິໂອ', 'ເບຍleo'
    ],

    // ===== PEPSI =====
    'ເປັບຊີ': [
        'pepsi', 'pepsii', 'pepsy',
        'ເປບຊີ', 'ເປັບຊິ', 'ເປັບຊີ່',
        'ເປັບຊີ້', 'ເປບຊີ້'
    ],

    // ===== COCA-COLA =====
    'ໂຄກ': [
        'coca-cola', 'coca cola', 'cocacola', 'coke', 'cola',
        'ໂຄຄາ', 'ໂຄ້ກ', 'ໂຄກາ', 'ໂຄກໂຄລາ',
        'ໂຄ໋ກ', 'ໂຄກ້າ', 'ໂຄລາ'
    ],

    // ===== SPRITE =====
    'ສະໄປຣ໌': [
        'sprite', 'sprit',
        'ສະໄປ', 'ສະປາຍ', 'ສະປາຍ໌',
        'ສະໄປຣ', 'ສະໄປຣີ'
    ],

    // ===== FANTA =====
    'ແຟັນຕ້າ': [
        'fanta', 'fantaa',
        'ແຟນຕ້າ', 'ແຟັນຕາ', 'ແຟນຕາ'
    ],

    // ===== RED BULL =====
    'ກະທິງແດງ': [
        'redbull', 'red bull', 'red-bull',
        'ກະທິງ ແດງ', 'ກະຖິງແດງ',
        'ຣີດບູລ', 'ຣິດບູລ'
    ],

    // ===== M-150 =====
    'ເອັມ150': [
        'm150', 'm-150', 'm 150',
        'ເອັມ 150', 'ເອັມ-150',
        'ເອມ150', 'ເອມ 150'
    ],

    // ===== FOOD ITEMS =====
    'ເຂົ້າໜຽວ': ['sticky rice', 'ข้าวเหนียว', 'ເຂົ້າໜຽວຂາວ'],
    'ໄຂ່ດາວ': ['fried egg', 'ไข่ดาว', 'ໄຂ່ຈືນ', 'ໄຂ່ທອດ']
};

/**
 * Build reverse synonym map for quick lookup
 * Maps each synonym to its canonical form
 */
const REVERSE_SYNONYM_MAP = {};
for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
    // Map canonical to itself
    REVERSE_SYNONYM_MAP[canonical.toLowerCase()] = canonical;
    // Map each synonym to canonical
    for (const syn of synonyms) {
        REVERSE_SYNONYM_MAP[syn.toLowerCase()] = canonical;
    }
}

/**
 * Get canonical form of a word if it's a known synonym
 * @param {string} text - Text to check
 * @returns {string|null} - Canonical form or null if not found
 */
const getCanonicalForm = (text) => {
    if (!text) return null;
    const normalized = text.toLowerCase().trim();
    return REVERSE_SYNONYM_MAP[normalized] || null;
};

// =============================================================================
// CATEGORY KEYWORDS
// =============================================================================

/**
 * Category keywords in multiple languages (Lao, Thai, English)
 * Used to detect the food/drink category before matching
 */
const CATEGORY_KEYWORDS = {
    // Beverages - Non-Alcoholic
    COFFEE: {
        keywords: ['ກາເຟ', 'กาแฟ', 'coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'ລາເຕ້', 'ຄາປູຊິໂນ', 'ໂມຄ່າ', 'ເອສເປຣສໂຊ'],
        masterCategoryCode: 'MCAT-COFFEE'
    },
    TEA: {
        keywords: ['ຊາ', 'ชา', 'tea', 'ຊານົມ', 'ชานม', 'matcha', 'ມັດຊະ'],
        masterCategoryCode: 'MCAT-TEA',
        excludeKeywords: ['ເຫຼົ້າ', 'ເບຍ', 'whiskey', 'beer', 'wine'] // Don't match alcohol to tea
    },
    JUICE: {
        keywords: ['ນ້ຳ', 'น้ำ', 'juice', 'ນ້ຳໝາກ', 'น้ำผลไม้', 'smoothie', 'ສະມູດ', 'shake', 'ນ້ຳສົ້ມ', 'ນ້ຳໝາກນາວ', 'ນ້ຳໝາກໂມ'],
        masterCategoryCode: 'MCAT-JUICE',
        excludeKeywords: ['ເຫຼົ້າ', 'ເບຍ', 'whiskey', 'beer']
    },
    SOFT_DRINKS: {
        keywords: ['ໂຄກ', 'โค้ก', 'coke', 'coca', 'pepsi', 'sprite', 'fanta', 'ເປັບຊີ', 'ສະໄປຣ', 'ແຟນຕ້າ', 'soda', 'ໂຊດາ', 'redbull', 'ເຣດບູລ'],
        masterCategoryCode: 'MCAT-SOFTDRINKS'
    },

    // Alcoholic Beverages
    BEER: {
        keywords: [
            'ເບຍ', 'เบียร์', 'beer', 'beerlao',
            // Heineken - all variations
            'heineken', 'heiniken', 'heinekan', 'heiken',
            'ໄຮເນເກັ້ນ', 'ໄຮເນເກັນ', 'ໄຊເນເກັ້ນ', 'ໄຊເນເກັນ',
            'ໄຊນິເກັ້ນ', 'ໄຊນິເກັນ', 'ໄຮນິເກັ້ນ', 'ໄຊລືເກັ້ນ',
            // Other beers
            'tiger', 'ໄທເກີ', 'carlsberg', 'ຄາລສເບີກ',
            'singha', 'สิงห์', 'chang', 'ช้าง',
            'draft', 'ສົດ', 'ຖັງ', 'tower', 'ທາວເວີ',
            'asahi', 'sapporo', 'kirin', 'corona', 'budweiser', 'lager', 'ale',
            'bucket', 'ບັກເກັດ'
        ],
        masterCategoryCode: 'MCAT-BEER'
    },
    SPIRITS: {
        keywords: ['ເຫຼົ້າ', 'เหล้า', 'whiskey', 'whisky', 'vodka', 'rum', 'gin', 'tequila', 'cognac', 'brandy', 'johnnie', 'chivas', 'hennessy', 'jack daniel', 'ຈອນນີ', 'ຊີວັສ', 'ເຮັນເນຊີ', 'ແຈັກ', 'smirnoff', 'absolut', 'bacardi', 'ຣັມ', 'ວອດກາ', 'ຈິນ', 'ເຕກີລາ', 'ລາວລາວ', 'ເຫຼົ້າຂາວ'],
        masterCategoryCode: 'MCAT-SPIRITS'
    },
    WINE: {
        keywords: ['ໄວນ໌', 'ไวน์', 'wine', 'champagne', 'ແຊມເປນ', 'sparkling', 'red wine', 'white wine', 'rose', 'prosecco'],
        masterCategoryCode: 'MCAT-WINE'
    },
    COCKTAIL: {
        keywords: ['cocktail', 'ຄ໋ອກເທວ', 'mojito', 'ໂມຈິໂຕ', 'margarita', 'ມາກາຣິຕາ', 'martini', 'ມາຕິນີ', 'long island', 'ລອງໄອແລນ', 'bloody mary', 'cosmopolitan', 'gin tonic', 'screwdriver', 'shot', 'ຊ໋ອດ'],
        masterCategoryCode: 'MCAT-COCKTAILS'
    },

    // Rice Dishes
    RICE: {
        keywords: ['ເຂົ້າ', 'ข้าว', 'rice', 'fried rice', 'ເຂົ້າຜັດ', 'ข้าวผัด', 'ເຂົ້າໜຽວ', 'ข้าวเหนียว', 'sticky rice', 'ເຂົ້າມັນ', 'ข้าวมัน', 'ເຂົ້າໝູ', 'ข้าวหมู'],
        masterCategoryCode: 'MCAT-RICE'
    },

    // Noodles
    NOODLES: {
        keywords: ['ເຝີ', 'เฝอ', 'pho', 'ผัดไทย', 'pad thai', 'ຜັດໄທ', 'noodle', 'ເສັ້ນ', 'เส้น', 'ບະໝີ່', 'บะหมี่', 'ກ໋ວຍ', 'ก๋วย', 'kuay', 'ລາດໜ້າ', 'ราดหน้า', 'ຜັດຊີອິ໊ວ', 'ผัดซีอิ๊ว', 'ຜັດຂີ້ເມົາ'],
        masterCategoryCode: 'MCAT-NOODLES'
    },

    // Salads - Lao/Thai Style
    SALAD_LAO: {
        keywords: ['ລາບ', 'ลาบ', 'laab', 'ສົ້ມຕຳ', 'ส้มตำ', 'somtam', 'papaya', 'ຍຳ', 'ยำ', 'yum', 'ນ້ຳຕົກ', 'น้ำตก', 'namtok'],
        masterCategoryCode: 'MCAT-LAOSALAD'
    },

    // Soups & Curries
    SOUP: {
        keywords: ['ຕົ້ມ', 'ต้ม', 'tom', 'ແກງ', 'แกง', 'kaeng', 'curry', 'ຍຳ', 'soup', 'ນ້ຳແກງ', 'tom yum', 'ຕົ້ມຍຳ', 'tom kha', 'ຕົ້ມຂ່າ', 'green curry', 'ແກງຂຽວ', 'red curry', 'ແກງແດງ', 'massaman', 'panang'],
        masterCategoryCode: 'MCAT-SOUP'
    },

    // Grilled
    GRILLED: {
        keywords: ['ປີ້ງ', 'ย่าง', 'grill', 'ປາປີ້ງ', 'ปิ้ง', 'ຍ່າງ', 'bbq', 'barbecue', 'roast', 'ໝູຍ່າງ', 'หมูย่าง', 'ໄກ່ຍ່າງ', 'ไก่ย่าง', 'steak', 'ສະເຕັກ', 'skewer'],
        masterCategoryCode: 'MCAT-GRILLED'
    },

    // Fried
    FRIED: {
        keywords: ['ທອດ', 'ทอด', 'fried', 'deep fried', 'crispy', 'tempura', 'ຊຸບແປ້ງ', 'ชุบแป้ง', 'ກອບ', 'กรอบ'],
        masterCategoryCode: 'MCAT-FRIED'
    },

    // Stir-fry
    STIRFRY: {
        keywords: ['ຜັດ', 'ผัด', 'stir fry', 'stir-fry', 'ກະເພົາ', 'กะเพรา', 'basil', 'ຜັດຜັກ', 'ผัดผัก', 'ຜັກບົ໋ງ', 'ผักบุ้ง', 'morning glory'],
        masterCategoryCode: 'MCAT-STIRFRY'
    },

    // Seafood
    SEAFOOD: {
        keywords: ['ກຸ້ງ', 'กุ้ง', 'shrimp', 'prawn', 'ປາ', 'ปลา', 'fish', 'ປູ', 'ปู', 'crab', 'ປາຫມຶກ', 'ปลาหมึก', 'squid', 'calamari', 'ຫອຍ', 'หอย', 'shellfish', 'ທະເລ', 'ทะเล', 'seafood'],
        masterCategoryCode: 'MCAT-SEAFOOD'
    },

    // Boiled dishes
    BOILED: {
        keywords: ['ລວກ', 'ลวก', 'boiled', 'blanched', 'ລວກກຸ້ງ', 'กุ้งลวก', 'ລວກຫອຍ', 'หอยลวก', 'ແຊ່ນ້ຳປາ', 'แช่น้ำปลา'],
        masterCategoryCode: 'MCAT-BOILED'
    },

    // Papaya Salad (Tam)
    TAM: {
        keywords: ['ຕຳ', 'ตำ', 'tam', 'ສົ້ມຕຳ', 'ส้มตำ', 'somtam', 'papaya salad', 'ຕຳໝາກຫຸ່ງ', 'ส้มตำมะละกอ', 'ຕຳເຂົ້າປຸ້ນ', 'ส้มตำข้าวปุ้น', 'ຕຳຖາດ', 'ตำถาด', 'ຕຳຕ່ອນ'],
        masterCategoryCode: 'MCAT-LAOSALAD'
    },

    // Koy (Raw Lao dishes)
    KOY: {
        keywords: ['ກ້ອຍ', 'ก้อย', 'koy', 'koi', 'raw salad', 'ກ້ອຍປາ', 'ก้อยปลา', 'ກ້ອຍຊີ້ນ', 'ก้อยเนื้อ'],
        masterCategoryCode: 'MCAT-KOY'
    },

    // Tom Saeb (Lao spicy soup)
    TOMSAEB: {
        keywords: ['ຕົ້ມແຊບ', 'ต้มแซ่บ', 'tom saeb', 'tom saab', 'ແຊບ', 'แซ่บ'],
        masterCategoryCode: 'MCAT-TOMSAEB'
    },

    // Steamed dishes
    STEAMED: {
        keywords: ['ນືງ', 'ໜືງ', 'นึ่ง', 'steamed', 'ປານືງ', 'ปลานึ่ง', 'ກຸ້ງນືງ', 'กุ้งนึ่ง'],
        masterCategoryCode: 'MCAT-STEAMED'
    },

    // Extras / Basic items
    EXTRAS: {
        keywords: ['ນ້ຳກ້ອນ', 'ນໍ້າກ້ອນ', 'ນ້າກ້ອນ', 'ນ້ຳກອນ', 'ນໍ້າກອນ', 'น้ำแข็ง', 'ice', 'ກ້ອນ', 'ນ້ຳດື່ມ', 'ນໍ້າດື່ມ', 'น้ำดื่ม', 'water', 'ໄຂ່ດາວ', 'ไข่ดาว', 'fried egg', 'ເຂົ້າໜຽວ', 'ข้าวเหนียว', 'sticky rice', 'ເຂົ້າຈ້າວ', 'ข้าวสวย'],
        masterCategoryCode: 'MCAT-EXTRAS'
    },

    // Bar Snacks / Appetizers
    SNACKS: {
        keywords: ['ທອດເອັນ', 'กระดูกอ่อน', 'cartilage', 'ທອດຄາງ', 'คาง', 'chin', 'ທອດລູກຊີ້ນ', 'ลูกชิ้น', 'meatball', 'ທອດມັນ', 'มันฝรั่ง', 'french fries', 'ທອດຖົ່ວ', 'ถั่ว', 'peanuts', 'ທອດດູກຂ້າງ', 'ซี่โครง', 'ribs'],
        masterCategoryCode: 'MCAT-SNACKS'
    }
};

// =============================================================================
// TEXT NORMALIZATION
// =============================================================================

/**
 * Lao tone marks and vowel marks that can vary or be missing
 * - Mai Ek (່) U+0EC8
 * - Mai Tho (້) U+0EC9  
 * - Mai Ti (໊) U+0ECA
 * - Mai Catawa (໋) U+0ECB
 * - Niggahita (ໍ) U+0ECD
 * - Cancellation mark (໌) U+0ECC
 */
const LAO_TONE_MARKS = /[\u0EC8\u0EC9\u0ECA\u0ECB\u0ECC\u0ECD]/g;

/**
 * Thai tone marks
 * - Mai Ek (่) U+0E48
 * - Mai Tho (้) U+0E49
 * - Mai Tri (๊) U+0E4A
 * - Mai Chattawa (๋) U+0E4B
 */
const THAI_TONE_MARKS = /[\u0E48\u0E49\u0E4A\u0E4B]/g;

/**
 * Normalizes text for comparison while preserving Lao and Thai characters
 * 
 * Unicode Ranges:
 * - Thai: U+0E00 - U+0E7F
 * - Lao: U+0E80 - U+0EFF
 * 
 * Key Lao Vowel Variations:
 * - ໍ້າ (Niggahita + Mai Tho + Sara Aa) vs ້ຳ (Mai Tho + Sara Am) - both mean "water/liquid"
 * - These look visually similar but have different Unicode representations
 * 
 * @param {string} text - Text to normalize
 * @param {boolean} stripToneMarks - Whether to strip tone marks for fuzzy matching (default: false)
 * @returns {string} Normalized text
 */
const normalizeText = (text, stripToneMarks = false) => {
    if (!text) return '';

    let result = text
        // Convert to string if not already
        .toString()
        // Unicode NFC normalization (compose characters)
        .normalize('NFC')
        // Trim whitespace
        .trim()
        // Normalize whitespace (multiple spaces to single space)
        .replace(/\s+/g, ' ')
        // Convert English to lowercase (preserve Lao/Thai as-is)
        .replace(/[A-Z]/g, char => char.toLowerCase())
        // Remove emojis and special symbols
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[❍○●◯◎⭕]/gu, '')
        // Remove only specific punctuation, keep all letters including Lao/Thai
        .replace(/[.,!?;:'"()\[\]{}<>\/\\@#$%^&*+=`~_\-]+/g, ' ')
        // Remove numbers at start (like "120 ນ້ຳກ້ອນ" -> "ນ້ຳກ້ອນ")
        .replace(/^\d+\s+/, '')
        // Normalize whitespace again after punctuation removal
        .replace(/\s+/g, ' ')
        .trim();

    // CRITICAL: Normalize Lao vowel variations
    // ໍ້າ (U+0ECD + U+0EC9 + U+0EB2) → ້ຳ (U+0EC9 + U+0EB3)
    // This makes "ນໍ້າ" equivalent to "ນ້ຳ" (both mean "water/liquid" in Lao)
    result = result
        .replace(/ໍ້າ/g, '້ຳ')  // ໍ + ້ + າ → ້ + ຳ
        .replace(/ໍາ/g, 'ຳ')    // ໍ + າ → ຳ (without tone mark)
        .replace(/ໍ້/g, '້');   // Standalone niggahita + tone → just tone

    // Optionally strip tone marks for fuzzy matching
    if (stripToneMarks) {
        result = result
            .replace(LAO_TONE_MARKS, '')
            .replace(THAI_TONE_MARKS, '');
    }

    return result;
};

/**
 * Normalizes text with tone marks stripped for fuzzy comparison
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text without tone marks
 */
const normalizeTextFuzzy = (text) => {
    return normalizeText(text, true);
};

/**
 * Tokenize text into words/meaningful units
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of tokens
 */
const tokenizeText = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return [];

    // Split by whitespace
    return normalized.split(/\s+/).filter(token => token.length > 0);
};

// =============================================================================
// CATEGORY DETECTION
// =============================================================================

/**
 * Detects the category of a menu item based on keywords
 * @param {string} text - Menu name to analyze
 * @returns {Object} { category: string, confidence: number, masterCategoryCode: string }
 */
const detectCategory = (text) => {
    const normalizedText = normalizeText(text).toLowerCase();
    const tokens = tokenizeText(text).map(t => t.toLowerCase());

    let bestMatch = { category: 'UNKNOWN', confidence: 0, masterCategoryCode: null };

    for (const [category, config] of Object.entries(CATEGORY_KEYWORDS)) {
        let matchScore = 0;
        let matchCount = 0;

        // Check exclude keywords first - if found, skip this category
        if (config.excludeKeywords) {
            const hasExclude = config.excludeKeywords.some(kw =>
                normalizedText.includes(kw.toLowerCase())
            );
            if (hasExclude) continue;
        }

        // Check each keyword
        for (const keyword of config.keywords) {
            const kwLower = keyword.toLowerCase();

            // Exact token match (highest weight)
            if (tokens.includes(kwLower)) {
                matchScore += 3;
                matchCount++;
            }
            // Contains keyword (medium weight)
            else if (normalizedText.includes(kwLower)) {
                matchScore += 2;
                matchCount++;
            }
            // Keyword contains a token (lower weight)
            else if (tokens.some(t => kwLower.includes(t) && t.length >= 2)) {
                matchScore += 1;
                matchCount++;
            }
        }

        // Calculate confidence based on matches
        const confidence = matchCount > 0 ? Math.min(100, (matchScore / config.keywords.length) * 50 + matchCount * 10) : 0;

        if (confidence > bestMatch.confidence) {
            bestMatch = {
                category,
                confidence,
                masterCategoryCode: config.masterCategoryCode
            };
        }
    }

    return bestMatch;
};

// =============================================================================
// SIMILARITY ALGORITHMS
// =============================================================================

/**
 * Calculates Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
const levenshteinDistance = (str1, str2) => {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    // Create a 2D array to store the distances
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,     // Deletion
                    dp[i][j - 1] + 1,     // Insertion
                    dp[i - 1][j - 1] + 1  // Substitution
                );
            }
        }
    }

    return dp[m][n];
};

/**
 * Calculates basic character similarity score between two strings (0 to 1)
 * Uses both strict and fuzzy comparison (with tone marks stripped)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
const calculateCharSimilarity = (str1, str2) => {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);

    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    // Also try fuzzy comparison (without tone marks)
    const s1Fuzzy = normalizeTextFuzzy(str1);
    const s2Fuzzy = normalizeTextFuzzy(str2);

    // Exact match without tone marks is very high confidence
    if (s1Fuzzy === s2Fuzzy) return 0.98;

    // Calculate both distances and use the better one
    const maxLen = Math.max(s1.length, s2.length);
    const maxLenFuzzy = Math.max(s1Fuzzy.length, s2Fuzzy.length);

    const distance = levenshteinDistance(s1, s2);
    const distanceFuzzy = levenshteinDistance(s1Fuzzy, s2Fuzzy);

    const similarity = 1 - (distance / maxLen);
    const similarityFuzzy = maxLenFuzzy > 0 ? 1 - (distanceFuzzy / maxLenFuzzy) : 0;

    // Return the better score (with slight penalty for fuzzy match)
    return Math.max(similarity, similarityFuzzy * 0.95);
};

/**
 * Calculates token overlap score (Jaccard-like similarity)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Token overlap score (0-1)
 */
const calculateTokenOverlap = (str1, str2) => {
    const tokens1 = new Set(tokenizeText(str1).map(t => t.toLowerCase()));
    const tokens2 = new Set(tokenizeText(str2).map(t => t.toLowerCase()));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersection = 0;
    for (const token of tokens1) {
        if (tokens2.has(token)) {
            intersection++;
        }
    }

    // Jaccard similarity
    const union = tokens1.size + tokens2.size - intersection;
    return union > 0 ? intersection / union : 0;
};

/**
 * Checks if any significant keyword from master item is contained in the menu name
 * @param {string} menuName - The menu name to search in
 * @param {string[]} keywords - Keywords to find
 * @returns {Object} { found: boolean, matchedKeyword: string, isExactToken: boolean }
 */
const checkKeywordMatch = (menuName, keywords) => {
    if (!keywords || keywords.length === 0) return { found: false };

    const normalizedMenu = normalizeText(menuName).toLowerCase();
    const menuTokens = tokenizeText(menuName).map(t => t.toLowerCase());

    for (const keyword of keywords) {
        const kwLower = keyword.toLowerCase();

        // Exact token match
        if (menuTokens.includes(kwLower)) {
            return { found: true, matchedKeyword: keyword, isExactToken: true };
        }

        // Contains match (for longer keywords)
        if (kwLower.length >= 3 && normalizedMenu.includes(kwLower)) {
            return { found: true, matchedKeyword: keyword, isExactToken: false };
        }
    }

    return { found: false };
};

// =============================================================================
// MULTI-STRATEGY MATCHING
// =============================================================================

/**
 * Calculate similarity using multiple strategies and return combined score
 * 
 * Strategies:
 * 0. Synonym match: 98% (same meaning, different spelling)
 * 1. Exact match: 100%
 * 2. Keyword match (exact token): 95%
 * 3. Keyword match (contains): 85%
 * 4. Token overlap + char similarity: 60-80%
 * 5. Character similarity only: 40-60%
 * 6. Fuzzy match (without tone marks): 70-90%
 * 
 * @param {string} query - Menu name to match
 * @param {Object} candidate - Master menu object with name, name_en, name_th, keywords, categoryCode
 * @param {string} queryCategory - Detected category of the query
 * @returns {Object} { score: number, matchType: string, details: Object }
 */
const calculateMultiStrategyScore = (query, candidate, queryCategory) => {
    const normalizedQuery = normalizeText(query);
    const normalizedQueryFuzzy = normalizeTextFuzzy(query);

    // Names to check
    const candidateNames = [
        candidate.name,
        candidate.name_en,
        candidate.name_th,
        candidate.name_vi,
        candidate.name_cn,
        candidate.name_kr,
        candidate.name_jp
    ].filter(Boolean);

    // Keywords from candidate (ensure it's an array)
    let keywords = candidate.keywords || [];
    if (typeof keywords === 'string') {
        // Parse if it's a comma-separated string
        keywords = keywords.split(',').map(k => k.trim()).filter(Boolean);
    }

    // Also check learned keywords if they exist
    const learnedKeywords = candidate.learnedKeywords || [];
    const allKeywords = [...keywords, ...learnedKeywords];

    let bestScore = 0;
    let bestMatchType = 'none';
    let bestMatchDetails = {};

    // Strategy 0: Synonym match - check if query is a known synonym of candidate name
    for (const name of candidateNames) {
        const queryCanonical = getCanonicalForm(normalizedQuery);
        const nameCanonical = getCanonicalForm(normalizeText(name));

        if (queryCanonical && nameCanonical && queryCanonical === nameCanonical) {
            return {
                score: 0.98,
                matchType: 'synonym',
                details: { matchedName: name, canonical: queryCanonical }
            };
        }

        // Also check if any token in query matches a synonym
        const queryTokens = tokenizeText(query);
        for (const token of queryTokens) {
            const tokenCanonical = getCanonicalForm(token);
            if (tokenCanonical && nameCanonical && tokenCanonical === nameCanonical) {
                return {
                    score: 0.95,
                    matchType: 'synonym_token',
                    details: { matchedName: name, matchedToken: token, canonical: tokenCanonical }
                };
            }
        }
    }

    // Strategy 1: Exact match with any name variant
    for (const name of candidateNames) {
        if (normalizeText(name) === normalizedQuery) {
            return {
                score: 1.0,
                matchType: 'exact',
                details: { matchedName: name }
            };
        }
        // Also check fuzzy exact match (without tone marks)
        if (normalizeTextFuzzy(name) === normalizedQueryFuzzy) {
            return {
                score: 0.98,
                matchType: 'exact_fuzzy',
                details: { matchedName: name }
            };
        }
    }

    // Strategy 2: Keyword exact token match (including learned keywords)
    const keywordMatch = checkKeywordMatch(query, allKeywords);
    if (keywordMatch.found && keywordMatch.isExactToken) {
        const score = 0.95;
        if (score > bestScore) {
            bestScore = score;
            bestMatchType = 'keyword_exact';
            bestMatchDetails = { matchedKeyword: keywordMatch.matchedKeyword };
        }
    } else if (keywordMatch.found) {
        const score = 0.85;
        if (score > bestScore) {
            bestScore = score;
            bestMatchType = 'keyword_contains';
            bestMatchDetails = { matchedKeyword: keywordMatch.matchedKeyword };
        }
    }

    // Strategy 2.5: Check synonyms in keywords
    const queryTokens = tokenizeText(query);
    for (const kw of allKeywords) {
        const kwCanonical = getCanonicalForm(kw);
        for (const token of queryTokens) {
            const tokenCanonical = getCanonicalForm(token);
            if (kwCanonical && tokenCanonical && kwCanonical === tokenCanonical) {
                const score = 0.92;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatchType = 'keyword_synonym';
                    bestMatchDetails = { matchedKeyword: kw, queryToken: token, canonical: kwCanonical };
                }
            }
        }
    }

    // Strategy 3: Token overlap + name similarity
    for (const name of candidateNames) {
        const tokenOverlap = calculateTokenOverlap(query, name);
        const charSimilarity = calculateCharSimilarity(query, name);

        // Combined score with weights
        const combinedScore = (tokenOverlap * 0.6) + (charSimilarity * 0.4);

        if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestMatchType = 'combined';
            bestMatchDetails = {
                matchedName: name,
                tokenOverlap: Math.round(tokenOverlap * 100),
                charSimilarity: Math.round(charSimilarity * 100)
            };
        }
    }

    // Strategy 4: Character similarity only (fallback)
    for (const name of candidateNames) {
        const charSimilarity = calculateCharSimilarity(query, name);

        // Only use if no better match found, and apply penalty
        const adjustedScore = charSimilarity * 0.7; // 30% penalty for char-only match

        if (adjustedScore > bestScore && bestMatchType === 'none') {
            bestScore = adjustedScore;
            bestMatchType = 'char_only';
            bestMatchDetails = {
                matchedName: name,
                charSimilarity: Math.round(charSimilarity * 100)
            };
        }
    }

    // Apply category penalty if categories don't match
    if (queryCategory && queryCategory !== 'UNKNOWN' && candidate.categoryCode) {
        const candidateCategory = detectCategory(candidate.name);
        if (candidateCategory.category !== 'UNKNOWN' && candidateCategory.category !== queryCategory) {
            // Different categories - apply significant penalty
            bestScore *= 0.3;
            bestMatchDetails.categoryMismatch = true;
            bestMatchDetails.queryCategory = queryCategory;
            bestMatchDetails.candidateCategory = candidateCategory.category;
        }
    }

    return {
        score: bestScore,
        matchType: bestMatchType,
        details: bestMatchDetails
    };
};

// =============================================================================
// MAIN MATCHING FUNCTION
// =============================================================================

/**
 * Finds the best matches from a list of master candidates using multi-strategy matching
 * 
 * @param {string} query - The menu name to match
 * @param {Array} candidates - Array of master menu objects
 * @param {Object} options - Options for matching
 * @param {number} options.threshold - Minimum similarity score (default 0.5)
 * @param {number} options.limit - Maximum number of results (default 5)
 * @param {boolean} options.categoryFilter - Enable category filtering (default true)
 * @returns {Array} Array of matches with scores, sorted by relevance
 */
const findBestMatches = (query, candidates, threshold = 0.5, limit = 5) => {
    if (!query || !candidates || candidates.length === 0) {
        return [];
    }

    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return [];
    }

    // Detect query category
    const queryCategory = detectCategory(query);

    const results = [];

    for (const candidate of candidates) {
        const matchResult = calculateMultiStrategyScore(query, candidate, queryCategory.category);

        if (matchResult.score >= threshold) {
            results.push({
                candidate,
                score: matchResult.score,
                matchType: matchResult.matchType,
                details: matchResult.details,
                queryCategory: queryCategory
            });
        }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top results
    return results.slice(0, limit);
};

/**
 * Legacy compatibility function
 */
const calculateSimilarity = (str1, str2) => {
    return calculateCharSimilarity(str1, str2);
};

/**
 * Legacy compatibility function
 */
const containsKeyword = (text, keyword) => {
    const normalizedText = normalizeText(text).toLowerCase();
    const normalizedKeyword = normalizeText(keyword).toLowerCase();
    return normalizedText.includes(normalizedKeyword);
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // Core functions
    normalizeText,
    normalizeTextFuzzy,
    tokenizeText,
    detectCategory,

    // Synonym functions
    getCanonicalForm,
    SYNONYM_MAP,
    REVERSE_SYNONYM_MAP,

    // Similarity algorithms
    levenshteinDistance,
    calculateCharSimilarity,
    calculateTokenOverlap,
    checkKeywordMatch,
    calculateMultiStrategyScore,

    // Main matching function
    findBestMatches,

    // Legacy compatibility
    calculateSimilarity,
    containsKeyword,

    // Constants
    CATEGORY_KEYWORDS,
    LAO_TONE_MARKS,
    THAI_TONE_MARKS
};
