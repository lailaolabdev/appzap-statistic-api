/**
 * Size Variant Detection Utility
 * 
 * Detects product base name and size variants from menu names
 * for accurate analytics mapping in Laos restaurant context.
 * 
 * Standard sizes in Laos:
 * - Glass: ແກ້ວໃຫຍ່ (large, standard), ແກ້ວນ້ອຍ (small)
 * - Bottle: ຂວດນ້ອຍ 330ml (standard), ຂວດໃຫຍ່ 640ml (large)
 * - Tower: 2.5L (standard)
 * - Bucket: 12 ແກ້ວ (standard)
 */

// Product definitions with their keywords for detection
// COMPREHENSIVE VERSION: Includes all known spelling variations, abbreviations, and typos
const PRODUCT_DEFINITIONS = {
    'heineken': {
        name: 'Heineken',
        nameLao: 'ໄຮເນເກັ້ນ',
        productId: 'heineken',
        // Partial patterns for fuzzy matching (if text contains any of these, it's likely Heineken)
        partialPatterns: ['ໄຮເນ', 'ໄຊເນ', 'ໄຮນ', 'ໄຊນ', 'heinek', 'heinen', 'ໄຊເກ', 'ໄຮເກ'],
        keywords: [
            // === ENGLISH VARIATIONS ===
            'heineken', 'heinekan', 'heiniken', 'heiken', 'henekan', 'heneken', 'hienekan',
            'heiniken', 'heinekn', 'heinekin', 'hieneken', 'heinken', 'heniken',

            // === LAO STANDARD SPELLING ===
            'ໄຮເນເກັ້ນ', 'ໄຮເນເກັນ', 'ໄຮເນກັ້ນ', 'ໄຮເນກັນ', 'ໄຮເນເກນ',

            // === ໄຊ VARIATIONS (common typo: ໄຊ instead of ໄຮ) ===
            'ໄຊເນເກັ້ນ', 'ໄຊເນເກັນ', 'ໄຊເນກັ້ນ', 'ໄຊເນກັນ', 'ໄຊເນເກນ',
            'ໄຊມີເກັ້ນ', 'ໄຊເນິເກັນ', 'ໄຊເນີເກັ້ນ', 'ໄຊເນີເກັນ',

            // === ນິ VARIATIONS (ິ vowel variations) ===
            'ໄຮນິເກັ້ນ', 'ໄຮນິເກັນ', 'ໄຊນິເກັ້ນ', 'ໄຊນິເກັນ',
            'ໄຮນິເກນ', 'ໄຊນິເກນ',

            // === ນີ VARIATIONS (ີ long vowel) ===
            'ໄຮນີເກນ', 'ໄຮນີເກັນ', 'ໄຊນີເກນ', 'ໄຊນີເກັນ',
            'ໄຮນີເກັ້ນ', 'ໄຊນີເກັ້ນ',

            // === ໄນ VARIATIONS ===
            'ໄຮໄນເກ້ນ', 'ໄຮໄນເກັ້ນ', 'ໄຊໄນເກັ້ນ', 'ໄຊໄນເກນ',

            // === ລື VARIATIONS ===
            'ໄຊລືເກັ້ນ', 'ໄຊລືເກັນ', 'ໄຮລືເກັ້ນ', 'ໄຮລືເກນ',

            // === WITHOUT TONE MARKS (people skip them) ===
            'ໄຮເນກນ', 'ໄຊເນກນ', 'ໄຮນກນ', 'ໄຊນກນ',
            'ໄຮເນເກນ', 'ໄຊເນເກນ',

            // === DOUBLE ກ VARIATIONS (from screenshots) ===
            'ໄຮເນັ້ກເກັ້ນ', 'ໄຮເນັກເກັ້ນ', 'ໄຮເນັກເກັນ',
            'ໄຊເນັ້ກເກັ້ນ', 'ໄຊເນັກເກັ້ນ', 'ໄຊເນັກເກັນ',
            'ໄຮເນັ້ກ', 'ໄຮເນັກ', 'ໄຮເນັກກ',
            'ໄຊເນັ້ກ', 'ໄຊເນັກ', 'ໄຊເນັກກ',

            // === SHORT FORMS / ABBREVIATIONS ===
            'ໄຮເກັ້ນ', 'ໄຊເກັ້ນ', 'ໄຮເກັນ', 'ໄຊເກັນ',
            'ໄຮເກນ', 'ໄຊເກນ',
            'ໄຮນັກ', 'ໄຊນັກ', 'ໄຮນັ້ກ', 'ໄຊນັ້ກ',
            'ໄຮເນັກ', 'ໄຊເນັກ',

            // === VERY SHORT FORMS ===
            'ຝຣກ', 'ຟກ', 'ໄຮກ', 'ໄຊກ',

            // === WITH ເບຍ PREFIX ===
            'ເບຍໄຮ', 'ເບຍໄຊ',
            'ເບຍheineken', 'ເບຍheiniken', 'ເບຍheinekan', 'ເບຍheiken',
            'ເບຍໄຮເນເກັນ', 'ເບຍໄຊເນເກັ້ນ', 'ເບຍໄຮນິເກ້ນ', 'ເບຍໄຊນິເກັ້ນ',
            'ເບຍໄຮເນເກັ້ນ', 'ເບຍໄຊເນເກັນ',
            'ເບຍໄຮເນັ້ກ', 'ເບຍໄຊເນັ້ກ',

            // === PAIR/SET VARIATIONS ===
            'ຄູ່ຂອງheineken', 'ຄູ່heineken', 'ຄູ່ໄຮເນເກັ້ນ', 'ຄູ່ໄຊເນເກັ້ນ',
            'ຄູ່ໄຮ', 'ຄູ່ໄຊ'
        ],
        category: 'beer',
        hasBottle: true,
        hasCan: true,
        hasTower: true,
        hasBucket: true
    },
    'beerlao': {
        name: 'Beer Lao',
        nameLao: 'ເບຍລາວ',
        productId: 'beerlao',
        partialPatterns: ['ເບຍລາວ', 'ເບຍ ລາວ', 'beerlao', 'beer lao', 'ລາວເດີມ', 'ລາວໃໝ່', 'ລາວດຳ'],
        keywords: [
            // === ENGLISH VARIATIONS ===
            'beer lao', 'beerlao', 'lao beer', 'laobeer', 'beerlaos', 'beer laos',

            // === LAO STANDARD ===
            'ເບຍລາວ', 'ເບຍ ລາວ', 'ເບຍ-ລາວ',

            // === VARIANTS ===
            'ເບຍລາວເດີມ', 'ເບຍລາວໃໝ່', 'ເບຍລາວໃຫມ່', 'ເບຍລາວດຳ', 'ເບຍລາວຂາວ',
            'ລາວເດີມ', 'ລາວໃໝ່', 'ລາວດຳ', 'ລາວຂາວ',

            // === DARK BEER ===
            'ເບຍດຳ', 'ເບຍ ດຳ', 'dark lao', 'dark beer lao',

            // === TONE MARK VARIATIONS ===
            'ເບຍລາວ', 'ເບຍລາວ', 'ເບຍລາວ',

            // === WITH SIZES ===
            'ເບຍລາວນ້ອຍ', 'ເບຍລາວໃຫຍ່', 'ເບຍລາວແກ້ວ',

            // === ABBREVIATIONS ===
            'ບລ', 'ບ.ລ', 'ບລວ', 'ລວ'
        ],
        category: 'beer',
        hasBottle: true,
        hasCan: true,
        hasTower: true,
        hasBucket: true
    },
    'carlsberg': {
        name: 'Carlsberg',
        nameLao: 'ຄາລສເບີກ',
        productId: 'carlsberg',
        partialPatterns: ['ຄາລ', 'carls', 'ເບີກ'],
        keywords: [
            // === ENGLISH VARIATIONS ===
            'carlsberg', 'carlberg', 'carsberg', 'carlburg', 'carlsbirg', 'carlzbeg',
            'calsberg', 'calsber', 'karlsberg', 'karlberg',

            // === LAO VARIATIONS ===
            'ຄາລສເບີກ', 'ຄາລເບີກ', 'ຄາສເບີກ', 'ຄາລສເບັກ',
            'ຄາລເບິກ', 'ຄານເບີກ', 'ຄາລສະເບີກ',
            'ກາລສເບີກ', 'ກາລເບີກ',

            // === WITHOUT TONE MARKS ===
            'ຄາລສເບກ', 'ຄາລເບກ', 'ຄາສເບກ',

            // === WITH ເບຍ PREFIX ===
            'ເບຍຄາລສເບີກ', 'ເບຍຄາລເບີກ', 'ເບຍຄາສເບີກ',
            'ເບຍcarlsberg', 'ເບຍcarlberg',

            // === ABBREVIATIONS ===
            'ຄບ', 'ຄສບ', 'ຄລບ'
        ],
        category: 'beer',
        hasBottle: true,
        hasCan: true,
        hasTower: true,
        hasBucket: true
    },
    'tiger': {
        name: 'Tiger',
        nameLao: 'ໄທເກີ',
        productId: 'tiger',
        partialPatterns: ['ໄທເກ', 'tiger', 'ໄທເກີ'],
        keywords: [
            // === ENGLISH ===
            'tiger', 'tiger beer', 'tigerbeer',

            // === LAO VARIATIONS ===
            'ໄທເກີ', 'ໄທເກີ້', 'ໄຕເກີ', 'ໄຕເກີ້',
            'ໄທເກ', 'ໄຕເກ',
            'ທາຍເກີ', 'ທາຍເກີ້',

            // === WITHOUT TONE MARKS ===
            'ໄທເກ', 'ໄຕເກ',

            // === WITH ເບຍ PREFIX ===
            'ເບຍໄທເກີ', 'ເບຍໄຕເກີ', 'ເບຍtiger',
            'ເບຍໄທເກີ້', 'ເບຍໄຕເກີ້',

            // === ABBREVIATIONS ===
            'ທກ', 'ໄທກ'
        ],
        category: 'beer',
        hasBottle: true,
        hasCan: true,
        hasTower: true,
        hasBucket: true
    },
    'singha': {
        name: 'Singha',
        nameLao: 'ສິງ',
        productId: 'singha',
        partialPatterns: ['ສິງ', 'singha', 'singh'],
        keywords: [
            // === ENGLISH ===
            'singha', 'singh', 'singa', 'singhaa',

            // === LAO VARIATIONS ===
            'ສິງ', 'ສິງຫາ', 'ສີງ', 'ສີງຫາ',
            'ສິງຮາ', 'ສີງຮາ',

            // === WITH ເບຍ PREFIX ===
            'ເບຍສິງ', 'ເບຍສິງຫາ', 'ເບຍsingha',
            'ເບຍສີງ'
        ],
        category: 'beer',
        hasBottle: true,
        hasCan: true,
        hasTower: true,
        hasBucket: true
    },
    'chang': {
        name: 'Chang',
        nameLao: 'ຊ້າງ',
        productId: 'chang',
        partialPatterns: ['ຊ້າງ', 'ຊາງ', 'chang'],
        keywords: [
            // === ENGLISH ===
            'chang', 'chang beer', 'changbeer',

            // === LAO VARIATIONS ===
            'ຊ້າງ', 'ຊາງ', 'ຊ໋າງ',

            // === WITH ເບຍ PREFIX ===
            'ເບຍຊ້າງ', 'ເບຍຊາງ', 'ເບຍchang'
        ],
        category: 'beer',
        hasBottle: true,
        hasCan: true,
        hasTower: true,
        hasBucket: true
    },
    'leo': {
        name: 'Leo',
        nameLao: 'ລີໂອ',
        productId: 'leo',
        partialPatterns: ['ລີໂອ', 'ລິໂອ', 'leo'],
        keywords: [
            // === ENGLISH ===
            'leo', 'leo beer', 'leobeer',

            // === LAO VARIATIONS ===
            'ລີໂອ', 'ລິໂອ', 'ລິໂອ້', 'ລີໂອ້',

            // === WITH ເບຍ PREFIX ===
            'ເບຍລີໂອ', 'ເບຍລິໂອ', 'ເບຍleo'
        ],
        category: 'beer',
        hasBottle: true,
        hasCan: true,
        hasTower: true,
        hasBucket: true
    },
    'pepsi': {
        name: 'Pepsi',
        nameLao: 'ເປັບຊີ',
        productId: 'pepsi',
        partialPatterns: ['ເປັບ', 'ເປບ', 'pepsi'],
        keywords: [
            'pepsi', 'pepsii', 'pepsy',
            'ເປັບຊີ', 'ເປບຊີ', 'ເປັບຊິ', 'ເປັບຊີ່',
            'ເປັບຊີ້', 'ເປບຊີ້', 'ເປັບຊິ້'
        ],
        category: 'soft_drink',
        hasBottle: true,
        hasCan: true,
        hasTower: false,
        hasBucket: false
    },
    'coke': {
        name: 'Coca-Cola',
        nameLao: 'ໂຄກ',
        productId: 'coke',
        partialPatterns: ['ໂຄກ', 'ໂຄຄາ', 'coca', 'coke'],
        keywords: [
            'coca-cola', 'coca cola', 'cocacola', 'coke', 'cola',
            'ໂຄກ', 'ໂຄຄາ', 'ໂຄ້ກ', 'ໂຄກາ', 'ໂຄກໂຄລາ',
            'ໂຄ໋ກ', 'ໂຄກ້າ', 'ໂຄລາ'
        ],
        category: 'soft_drink',
        hasBottle: true,
        hasCan: true,
        hasTower: false,
        hasBucket: false
    },
    'sprite': {
        name: 'Sprite',
        nameLao: 'ສະໄປຣ໌',
        productId: 'sprite',
        partialPatterns: ['ສະໄປ', 'ສະປາຍ', 'sprite'],
        keywords: [
            'sprite', 'sprit',
            'ສະໄປຣ໌', 'ສະໄປ', 'ສະປາຍ', 'ສະປາຍ໌',
            'ສະໄປຣ', 'ສະໄປຣີ'
        ],
        category: 'soft_drink',
        hasBottle: true,
        hasCan: true,
        hasTower: false,
        hasBucket: false
    },
    'fanta': {
        name: 'Fanta',
        nameLao: 'ແຟັນຕ້າ',
        productId: 'fanta',
        partialPatterns: ['ແຟັນ', 'ແຟນຕ', 'fanta'],
        keywords: [
            'fanta', 'fantaa',
            'ແຟັນຕ້າ', 'ແຟນຕ້າ', 'ແຟັນຕາ', 'ແຟນຕາ',
            'ແຟັນຕາ້'
        ],
        category: 'soft_drink',
        hasBottle: true,
        hasCan: true,
        hasTower: false,
        hasBucket: false
    },
    'tigerhead': {
        name: 'Tiger Head Water',
        nameLao: 'ນ້ຳດື່ມຫົວເສືອ',
        productId: 'tigerhead',
        partialPatterns: ['ຫົວເສືອ', 'tiger head'],
        keywords: [
            'tiger head', 'tigerhead', 'tiger head water',
            'ຫົວເສືອ', 'ນ້ຳຫົວເສືອ', 'ນ້ຳດື່ມຫົວເສືອ', 'ນໍ້າຫົວເສືອ',
            'ນ້ຳຫົວເສື', 'ນໍ້າຫົວເສື'
        ],
        category: 'water',
        hasBottle: true,
        hasCan: false,
        hasTower: false,
        hasBucket: false
    },
    'redbull': {
        name: 'Red Bull',
        nameLao: 'ກະທິງແດງ',
        productId: 'redbull',
        partialPatterns: ['ກະທິງ', 'redbull', 'red bull'],
        keywords: [
            'redbull', 'red bull', 'red-bull',
            'ກະທິງແດງ', 'ກະທິງ ແດງ', 'ກະຖິງແດງ',
            'ຣີດບູລ', 'ຣິດບູລ', 'ຣີດບູນ'
        ],
        category: 'energy_drink',
        hasBottle: true,
        hasCan: true,
        hasTower: false,
        hasBucket: false
    },
    'm150': {
        name: 'M-150',
        nameLao: 'ເອັມ 150',
        productId: 'm150',
        partialPatterns: ['m150', 'm-150', 'ເອັມ150', 'ເອັມ 150'],
        keywords: [
            'm150', 'm-150', 'm 150',
            'ເອັມ150', 'ເອັມ 150', 'ເອັມ-150',
            'ເອມ150', 'ເອມ 150'
        ],
        category: 'energy_drink',
        hasBottle: true,
        hasCan: false,
        hasTower: false,
        hasBucket: false
    }
};


// Size variant definitions with detection keywords
// Terminology in Laos:
// - Bottle (ແກ້ວ) = drinking container at the table
// - Can (ປ໋ອງ) = aluminum beer can (330ml or 640ml)
const SIZE_VARIANTS = {
    // Bottle variants (ແກ້ວ - drinking container)
    'bottle_large': {
        name: 'ແກ້ວໃຫຍ່',
        nameEn: 'Large Bottle',
        category: 'bottle',
        keywords: ['ແກ້ວໃຫຍ່', 'ແກ້ວ ໃຫຍ່', 'ແກ້ບ່ວໃຫຍ່', 'bottle large', 'large bottle', 'ໃຫຍ່', ' l ', ' L ', '-l', '-L', 'ໃຫຽ່'],
        mlSize: null,
        isDefault: true,  // Standard bottle size in Laos
        priority: 10
    },
    'bottle_small': {
        name: 'ແກ້ວນ້ອຍ',
        nameEn: 'Small Bottle',
        category: 'bottle',
        keywords: ['ແກ້ວນ້ອຍ', 'ແກ້ວ ນ້ອຍ', 'bottle small', 'small bottle', 'ນ້ອຍ', ' s ', ' S ', '-s', '-S'],
        mlSize: null,
        isDefault: false,
        priority: 9
    },
    // Can variants (ປ໋ອງ - aluminum can)
    'can_small': {
        name: 'ປ໋ອງນ້ອຍ 330ml',
        nameEn: 'Small Can 330ml',
        category: 'can',
        keywords: ['ປ໋ອງນ້ອຍ', 'ປ໋ອງ ນ້ອຍ', 'ຂວດນ້ອຍ', 'ຂ້ວງນ້ອຍ', 'ຂວດ ນ້ອຍ', '330ml', '330 ml', 'ຂ້ວງ', 'ຂວດ', 'ປ໋ອງ', 'can small', 'small can'],
        mlSize: 330,
        isDefault: false,
        priority: 8
    },
    'can_large': {
        name: 'ປ໋ອງໃຫຍ່ 640ml',
        nameEn: 'Large Can 640ml',
        category: 'can',
        keywords: ['ປ໋ອງໃຫຍ່', 'ປ໋ອງ ໃຫຍ່', 'ຂວດໃຫຍ່', 'ຂ້ວງໃຫຍ່', 'ຂວດ ໃຫຍ່', '640ml', '640 ml', 'can large', 'large can'],
        mlSize: 640,
        isDefault: false,
        priority: 7
    },
    // Tower
    'tower': {
        name: 'Tower 2.5L',
        nameEn: 'Tower 2.5L',
        category: 'tower',
        keywords: ['tower', 'ທາວເວີ', 'ເທົາເວີ', 'ທາວເວີ້', 'ເທົາເວີ້', '2.5l', '2.5 l', '2.5ລິດ', 'ລິດ'],
        mlSize: 2500,
        isDefault: false,
        priority: 6
    },
    // Bucket
    'bucket': {
        name: 'Bucket 12 ແກ້ວ',
        nameEn: 'Bucket 12 Bottles',
        category: 'bucket',
        keywords: ['bucket', 'ບັກເກັດ', 'ຖັງ', '12 ແກ້ວ', '12ແກ້ວ', 'ຊຸດ', 'ແພັກ', 'pack'],
        bottleCount: 12,
        isDefault: false,
        priority: 5
    },
    // Water bottle sizes (actual bottles for water)
    'water_500ml': {
        name: 'ຂວດ 500ml',
        nameEn: 'Water 500ml',
        category: 'water_bottle',
        keywords: ['500ml', '500 ml', '0.5l', '0.5 l'],
        mlSize: 500,
        isDefault: true,
        priority: 3
    },
    'water_1500ml': {
        name: 'ຂວດ 1.5L',
        nameEn: 'Water 1.5L',
        category: 'water_bottle',
        keywords: ['1.5l', '1.5 l', '1500ml', '1500 ml', '1.5ລິດ'],
        mlSize: 1500,
        isDefault: false,
        priority: 2
    },
    'water_6l': {
        name: 'ຂວດ 6L',
        nameEn: 'Water 6L',
        category: 'water_bottle',
        keywords: ['6l', '6 l', '6ລິດ', '6 ລິດ'],
        mlSize: 6000,
        isDefault: false,
        priority: 1
    }
};

// Normalize text for comparison
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
        // Remove emojis
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[❍○●◯◎⭕]/gu, '')
        // CRITICAL: Normalize Lao vowel variations
        // ໍ້າ (U+0ECD + U+0EC9 + U+0EB2) → ້ຳ (U+0EC9 + U+0EB3)
        // This makes "ນໍ້າ" equivalent to "ນ້ຳ" (both mean "water/liquid" in Lao)
        .replace(/ໍ້າ/g, '້ຳ')  // ໍ + ້ + າ → ້ + ຳ
        .replace(/ໍາ/g, 'ຳ')    // ໍ + າ → ຳ (without tone mark)
        .replace(/ໍ້/g, '້')   // Standalone niggahita + tone → just tone
        // Remove numbers at the start
        .replace(/^\d+\s+/, '')
        .trim();
}

/**
 * Detect the base product from a menu name
 * Uses two-phase detection:
 * 1. Exact keyword matching (high confidence)
 * 2. Partial pattern matching (lower confidence but catches more variations)
 * 
 * @param {string} menuName - The menu name to analyze
 * @returns {object|null} - Product definition or null if not found
 */
function detectBaseProduct(menuName) {
    const normalized = normalizeText(menuName);

    // Phase 1: Exact keyword matching (highest priority)
    for (const [productId, product] of Object.entries(PRODUCT_DEFINITIONS)) {
        for (const keyword of product.keywords) {
            if (normalized.includes(normalizeText(keyword))) {
                return {
                    productId,
                    matchType: 'exact_keyword',
                    matchedKeyword: keyword,
                    ...product
                };
            }
        }
    }

    // Phase 2: Partial pattern matching (catches variations not in keyword list)
    for (const [productId, product] of Object.entries(PRODUCT_DEFINITIONS)) {
        if (product.partialPatterns) {
            for (const pattern of product.partialPatterns) {
                if (normalized.includes(normalizeText(pattern))) {
                    return {
                        productId,
                        matchType: 'partial_pattern',
                        matchedPattern: pattern,
                        ...product
                    };
                }
            }
        }
    }

    return null;
}

/**
 * Detect the size variant from a menu name
 * @param {string} menuName - The menu name to analyze
 * @param {object} product - The detected product (optional)
 * @returns {object|null} - Size variant or null if not detected
 */
function detectSizeVariant(menuName, product = null) {
    const normalized = normalizeText(menuName);

    // Sort variants by priority (higher priority = more specific match)
    const sortedVariants = Object.entries(SIZE_VARIANTS)
        .sort((a, b) => b[1].priority - a[1].priority);

    for (const [variantId, variant] of sortedVariants) {
        // Check if this variant category is applicable to the product
        if (product) {
            if (variant.category === 'bottle' && !product.hasBottle) continue;
            if (variant.category === 'can' && !product.hasCan) continue;
            if (variant.category === 'tower' && !product.hasTower) continue;
            if (variant.category === 'bucket' && !product.hasBucket) continue;
            if (variant.category === 'water_bottle' && product.category !== 'water') continue;
        }

        for (const keyword of variant.keywords) {
            if (normalized.includes(normalizeText(keyword))) {
                return {
                    variantId,
                    ...variant
                };
            }
        }
    }

    // If no specific size found, try to infer from context
    // For beer, default to large bottle if "ແກ້ວ" is mentioned without size
    if (product && product.category === 'beer') {
        if (normalized.includes('ແກ້ວ') || normalized.includes('bottle')) {
            return {
                variantId: 'bottle_large',
                ...SIZE_VARIANTS['bottle_large'],
                inferred: true
            };
        }
    }

    return null;
}

/**
 * Get the default size variant for a product
 * @param {object} product - The product definition
 * @returns {object} - Default size variant
 */
function getDefaultVariant(product) {
    if (!product) return null;

    // For beer, default is large bottle (ແກ້ວໃຫຍ່)
    if (product.category === 'beer') {
        return {
            variantId: 'bottle_large',
            ...SIZE_VARIANTS['bottle_large'],
            isDefault: true
        };
    }

    // For soft drinks, default is small can
    if (product.category === 'soft_drink') {
        return {
            variantId: 'can_small',
            ...SIZE_VARIANTS['can_small'],
            isDefault: true
        };
    }

    // For water, default is 500ml water bottle
    if (product.category === 'water') {
        return {
            variantId: 'water_500ml',
            ...SIZE_VARIANTS['water_500ml'],
            isDefault: true
        };
    }

    return null;
}

/**
 * Analyze a menu name and return full detection result
 * @param {string} menuName - The menu name to analyze
 * @returns {object} - Full analysis result
 */
function analyzeMenuName(menuName) {
    const product = detectBaseProduct(menuName);
    const sizeVariant = detectSizeVariant(menuName, product);
    const defaultVariant = product ? getDefaultVariant(product) : null;

    // Determine the final variant to use
    const finalVariant = sizeVariant || defaultVariant;

    // Generate the suggested master menu name
    let suggestedMasterName = null;
    let suggestedMasterNameEn = null;

    if (product && finalVariant) {
        suggestedMasterName = `${product.nameLao} - ${finalVariant.name}`;
        suggestedMasterNameEn = `${product.name} - ${finalVariant.nameEn}`;
    } else if (product) {
        suggestedMasterName = product.nameLao;
        suggestedMasterNameEn = product.name;
    }

    return {
        originalName: menuName,
        product,
        sizeVariant,
        defaultVariant,
        finalVariant,
        suggestedMasterName,
        suggestedMasterNameEn,
        isKnownProduct: !!product,
        hasDetectedVariant: !!sizeVariant,
        usedDefaultVariant: !sizeVariant && !!defaultVariant
    };
}

/**
 * Generate all master menu variants for a product
 * @param {string} productId - The product ID
 * @returns {array} - Array of master menu definitions
 */
function generateProductVariants(productId) {
    const product = PRODUCT_DEFINITIONS[productId];
    if (!product) return [];

    const variants = [];

    // Beer products get bottle (ແກ້ວ), can (ປ໋ອງ), tower, bucket
    if (product.category === 'beer') {
        if (product.hasBottle) {
            // Bottle = ແກ້ວ (drinking container)
            variants.push({
                productId,
                variantId: 'bottle_large',
                name: `${product.nameLao} - ແກ້ວໃຫຍ່`,
                nameEn: `${product.name} - Large Bottle`,
                category: product.category,
                sizeCategory: 'bottle',
                isDefault: true
            });
            variants.push({
                productId,
                variantId: 'bottle_small',
                name: `${product.nameLao} - ແກ້ວນ້ອຍ`,
                nameEn: `${product.name} - Small Bottle`,
                category: product.category,
                sizeCategory: 'bottle',
                isDefault: false
            });
        }
        if (product.hasCan) {
            // Can = ປ໋ອງ (aluminum can)
            variants.push({
                productId,
                variantId: 'can_large',
                name: `${product.nameLao} - ປ໋ອງໃຫຍ່ 640ml`,
                nameEn: `${product.name} - Large Can 640ml`,
                category: product.category,
                sizeCategory: 'can',
                isDefault: false
            });
            variants.push({
                productId,
                variantId: 'can_small',
                name: `${product.nameLao} - ປ໋ອງນ້ອຍ 330ml`,
                nameEn: `${product.name} - Small Can 330ml`,
                category: product.category,
                sizeCategory: 'can',
                isDefault: false
            });
        }
        if (product.hasTower) {
            variants.push({
                productId,
                variantId: 'tower',
                name: `${product.nameLao} - Tower 2.5L`,
                nameEn: `${product.name} - Tower 2.5L`,
                category: product.category,
                sizeCategory: 'tower',
                isDefault: false
            });
        }
        if (product.hasBucket) {
            variants.push({
                productId,
                variantId: 'bucket',
                name: `${product.nameLao} - Bucket 12 ແກ້ວ`,
                nameEn: `${product.name} - Bucket 12 Bottles`,
                category: product.category,
                sizeCategory: 'bucket',
                isDefault: false
            });
        }
    }

    // Soft drinks get bottle (ແກ້ວ) and can (ປ໋ອງ)
    if (product.category === 'soft_drink') {
        if (product.hasBottle) {
            variants.push({
                productId,
                variantId: 'bottle_large',
                name: `${product.nameLao} - ແກ້ວ`,
                nameEn: `${product.name} - Bottle`,
                category: product.category,
                sizeCategory: 'bottle',
                isDefault: false
            });
        }
        if (product.hasCan) {
            variants.push({
                productId,
                variantId: 'can_small',
                name: `${product.nameLao} - ປ໋ອງ`,
                nameEn: `${product.name} - Can`,
                category: product.category,
                sizeCategory: 'can',
                isDefault: true
            });
        }
    }

    // Water gets water bottle sizes
    if (product.category === 'water') {
        variants.push({
            productId,
            variantId: 'water_500ml',
            name: `${product.nameLao} - 500ml`,
            nameEn: `${product.name} - 500ml`,
            category: product.category,
            sizeCategory: 'water_bottle',
            isDefault: true
        });
        variants.push({
            productId,
            variantId: 'water_1500ml',
            name: `${product.nameLao} - 1.5L`,
            nameEn: `${product.name} - 1.5L`,
            category: product.category,
            sizeCategory: 'water_bottle',
            isDefault: false
        });
        variants.push({
            productId,
            variantId: 'water_6l',
            name: `${product.nameLao} - 6L`,
            nameEn: `${product.name} - 6L`,
            category: product.category,
            sizeCategory: 'water_bottle',
            isDefault: false
        });
    }

    return variants;
}

/**
 * Generate all master menu variants for all defined products
 * @returns {array} - Array of all master menu definitions
 */
function generateAllProductVariants() {
    const allVariants = [];

    for (const productId of Object.keys(PRODUCT_DEFINITIONS)) {
        const variants = generateProductVariants(productId);
        allVariants.push(...variants);
    }

    return allVariants;
}

/**
 * Find the best matching master menu variant for a menu name
 * @param {string} menuName - The menu name to match
 * @param {array} masterMenus - Array of master menus to match against
 * @returns {object|null} - Best match result or null
 */
function findBestVariantMatch(menuName, masterMenus) {
    const analysis = analyzeMenuName(menuName);

    if (!analysis.product || !analysis.finalVariant) {
        return null;
    }

    // Filter master menus by product
    const productMatches = masterMenus.filter(m =>
        m.baseProduct === analysis.product.productId ||
        normalizeText(m.name).includes(normalizeText(analysis.product.nameLao)) ||
        normalizeText(m.name).includes(normalizeText(analysis.product.name))
    );

    if (productMatches.length === 0) {
        return {
            analysis,
            match: null,
            reason: 'no_product_match'
        };
    }

    // Find exact variant match
    const variantMatch = productMatches.find(m =>
        m.sizeVariant === analysis.finalVariant.variantId
    );

    if (variantMatch) {
        return {
            analysis,
            match: variantMatch,
            confidence: 95,
            reason: 'exact_variant_match'
        };
    }

    // Find by variant keywords in name
    for (const m of productMatches) {
        const mNormalized = normalizeText(m.name);
        for (const keyword of analysis.finalVariant.keywords) {
            if (mNormalized.includes(normalizeText(keyword))) {
                return {
                    analysis,
                    match: m,
                    confidence: 85,
                    reason: 'keyword_variant_match'
                };
            }
        }
    }

    // Return default variant if exists
    const defaultMatch = productMatches.find(m => m.isDefault);
    if (defaultMatch) {
        return {
            analysis,
            match: defaultMatch,
            confidence: 60,
            reason: 'default_variant_fallback'
        };
    }

    // Return first product match as last resort
    return {
        analysis,
        match: productMatches[0],
        confidence: 50,
        reason: 'product_only_match'
    };
}

module.exports = {
    PRODUCT_DEFINITIONS,
    SIZE_VARIANTS,
    normalizeText,
    detectBaseProduct,
    detectSizeVariant,
    getDefaultVariant,
    analyzeMenuName,
    generateProductVariants,
    generateAllProductVariants,
    findBestVariantMatch
};
