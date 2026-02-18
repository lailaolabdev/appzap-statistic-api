/**
 * Excel Import Controller
 * 
 * Handles Excel file upload and data import for subscription seeding.
 * Matches restaurants by name, phone, or _id with POS version identification.
 */

const { ObjectId } = require('mongodb');
const xlsx = require('xlsx');
const multer = require('multer');
const { 
    getPosV1Db, 
    getPosV2Db, 
    updateRestaurantSubscription 
} = require('../utils/multiDbConnection');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xls, .xlsx) are allowed'));
        }
    }
});

const excelImportController = {
    /**
     * Multer middleware for file upload
     */
    uploadMiddleware: upload.single('file'),

    /**
     * Parse Excel file and preview data
     */
    parseExcel: async (req, res, db) => {
        try {
            if (!req.file) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No file uploaded' 
                });
            }

            // Parse Excel file
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (rawData.length < 2) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Excel file is empty or has no data rows' 
                });
            }

            // Extract headers and data
            const headers = rawData[0].map(h => String(h).trim());
            const rows = rawData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

            // Detect column mapping
            const suggestedMapping = detectColumnMapping(headers);

            res.json({
                success: true,
                data: {
                    filename: req.file.originalname,
                    sheetName,
                    totalRows: rows.length,
                    headers,
                    suggestedMapping,
                    preview: rows.slice(0, 10).map((row, index) => {
                        const obj = { _rowIndex: index + 2 }; // Excel row number (1-indexed + header)
                        headers.forEach((header, i) => {
                            obj[header] = row[i];
                        });
                        return obj;
                    }),
                },
            });
        } catch (error) {
            console.error('[ExcelImport] Error parsing Excel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Validate and match restaurants from Excel data
     */
    validateAndMatch: async (req, res, db) => {
        try {
            const { 
                rows, 
                columnMapping, 
                defaultPosVersion 
            } = req.body;

            if (!rows || !Array.isArray(rows)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'rows array is required' 
                });
            }

            if (!columnMapping) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'columnMapping is required' 
                });
            }

            const results = {
                total: rows.length,
                matched: [],
                unmatched: [],
                duplicates: [],
            };

            const matchedIds = new Set();

            for (const row of rows) {
                const restaurantId = row[columnMapping.restaurantId];
                const name = row[columnMapping.name];
                const phone = row[columnMapping.phone];
                const posVersion = row[columnMapping.posVersion] || defaultPosVersion || 'v1';
                const startDate = parseExcelDate(row[columnMapping.startDate]);
                const endDate = parseExcelDate(row[columnMapping.endDate]);
                const period = row[columnMapping.period];

                // Try to match restaurant
                const match = await findRestaurantMatch(
                    restaurantId, 
                    name, 
                    phone, 
                    posVersion
                );

                if (match) {
                    const matchKey = `${match.posVersion}-${match.id}`;
                    
                    if (matchedIds.has(matchKey)) {
                        results.duplicates.push({
                            row,
                            match,
                            reason: 'Duplicate restaurant in import',
                        });
                    } else {
                        matchedIds.add(matchKey);
                        results.matched.push({
                            row,
                            match,
                            startDate,
                            endDate,
                            period,
                            changes: {
                                startDate: { from: match.currentStartDate, to: startDate },
                                endDate: { from: match.currentEndDate, to: endDate },
                                period: { from: match.currentPeriod, to: period },
                            },
                        });
                    }
                } else {
                    results.unmatched.push({
                        row,
                        searchCriteria: { restaurantId, name, phone, posVersion },
                        reason: 'No matching restaurant found',
                    });
                }
            }

            res.json({
                success: true,
                data: results,
            });
        } catch (error) {
            console.error('[ExcelImport] Error validating:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Execute import (update subscription data)
     */
    executeImport: async (req, res, db) => {
        try {
            const { matches, dryRun = false } = req.body;

            if (!matches || !Array.isArray(matches)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'matches array is required' 
                });
            }

            const results = {
                total: matches.length,
                success: 0,
                failed: 0,
                skipped: 0,
                details: [],
            };

            for (const item of matches) {
                try {
                    if (!item.match || !item.match.id) {
                        results.skipped++;
                        results.details.push({
                            ...item,
                            status: 'skipped',
                            reason: 'No valid match',
                        });
                        continue;
                    }

                    if (!dryRun) {
                        const updateResult = await updateRestaurantSubscription(
                            item.match.id,
                            item.match.posVersion,
                            {
                                startDate: item.startDate,
                                endDate: item.endDate,
                                period: item.period,
                            }
                        );

                        if (updateResult.modifiedCount > 0) {
                            results.success++;
                            results.details.push({
                                ...item,
                                status: 'success',
                            });
                        } else {
                            results.failed++;
                            results.details.push({
                                ...item,
                                status: 'failed',
                                reason: 'No changes made (data may be the same)',
                            });
                        }
                    } else {
                        results.success++;
                        results.details.push({
                            ...item,
                            status: 'dry_run',
                        });
                    }
                } catch (error) {
                    results.failed++;
                    results.details.push({
                        ...item,
                        status: 'failed',
                        reason: error.message,
                    });
                }
            }

            res.json({
                success: true,
                data: results,
                message: dryRun 
                    ? `Dry run completed. ${results.success} restaurants would be updated.`
                    : `Import completed. ${results.success} updated, ${results.failed} failed, ${results.skipped} skipped.`,
            });
        } catch (error) {
            console.error('[ExcelImport] Error executing import:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get sample Excel template
     */
    getSampleTemplate: async (req, res, db) => {
        try {
            // Create sample workbook
            const workbook = xlsx.utils.book_new();
            
            const sampleData = [
                ['Restaurant ID', 'Restaurant Name', 'Phone', 'POS Version', 'Start Date', 'End Date', 'Period (months)'],
                ['', 'ຮ້ານອາຫານທົດສອບ', '020-1234-5678', 'v1', '2026-01-01', '2026-12-31', '12'],
                ['64abc123def456789012345', 'Test Restaurant', '+856-20-9876-5432', 'v2', '2026-02-01', '2027-01-31', '12'],
            ];

            const worksheet = xlsx.utils.aoa_to_sheet(sampleData);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Subscriptions');

            // Generate buffer
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="subscription_import_template.xlsx"');
            res.send(buffer);
        } catch (error) {
            console.error('[ExcelImport] Error generating template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

/**
 * Detect column mapping from headers
 */
function detectColumnMapping(headers) {
    const mapping = {
        restaurantId: null,
        name: null,
        phone: null,
        posVersion: null,
        startDate: null,
        endDate: null,
        period: null,
    };

    const patterns = {
        restaurantId: /^(restaurant[_\s]?id|_id|id|ລະຫັດ)$/i,
        name: /^(name|restaurant[_\s]?name|ຊື່|ຊື່ຮ້ານ)$/i,
        phone: /^(phone|tel|telephone|mobile|ເບີໂທ|ໂທລະສັບ)$/i,
        posVersion: /^(pos[_\s]?version|version|v|ເວີຊັນ)$/i,
        startDate: /^(start[_\s]?date|subscription[_\s]?start|ວັນທີເລີ່ມ)$/i,
        endDate: /^(end[_\s]?date|subscription[_\s]?end|expiry|expire|ວັນທີໝົດ|ໝົດກຳນົດ)$/i,
        period: /^(period|months|ໄລຍະ|ເດືອນ)$/i,
    };

    headers.forEach(header => {
        for (const [field, pattern] of Object.entries(patterns)) {
            if (pattern.test(header) && !mapping[field]) {
                mapping[field] = header;
            }
        }
    });

    return mapping;
}

/**
 * Parse Excel date value
 */
function parseExcelDate(value) {
    if (!value) return null;
    
    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + value * 86400000);
    }

    // If it's a string, try to parse
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
        
        // Try DD/MM/YYYY format
        const ddmmyyyy = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyy) {
            return new Date(ddmmyyyy[3], ddmmyyyy[2] - 1, ddmmyyyy[1]);
        }
    }

    // If it's already a Date
    if (value instanceof Date) {
        return value;
    }

    return null;
}

/**
 * Find restaurant match from POS databases
 */
async function findRestaurantMatch(restaurantId, name, phone, posVersion) {
    const posV1Db = getPosV1Db();
    const posV2Db = getPosV2Db();

    // Try by ID first
    if (restaurantId) {
        try {
            const objectId = new ObjectId(restaurantId);
            
            if (posVersion === 'v1' && posV1Db) {
                const found = await posV1Db.collection('stores').findOne({ _id: objectId });
                if (found) {
                    return formatMatch(found, 'v1');
                }
            }
            
            if (posVersion === 'v2' && posV2Db) {
                const found = await posV2Db.collection('restaurants').findOne({ _id: objectId });
                if (found) {
                    return formatMatch(found, 'v2');
                }
            }
        } catch (e) {
            // Invalid ObjectId, continue to name/phone search
        }
    }

    // Try by name and phone
    const searchName = name ? escapeRegex(name.trim()) : null;
    const searchPhone = phone ? phone.replace(/\D/g, '') : null;

    // Search POS v1
    if (posV1Db && (posVersion === 'v1' || !posVersion)) {
        const query = buildSearchQuery(searchName, searchPhone, 'v1');
        if (query) {
            const found = await posV1Db.collection('stores').findOne(query);
            if (found) {
                return formatMatch(found, 'v1');
            }
        }
    }

    // Search POS v2
    if (posV2Db && (posVersion === 'v2' || !posVersion)) {
        const query = buildSearchQuery(searchName, searchPhone, 'v2');
        if (query) {
            const found = await posV2Db.collection('restaurants').findOne(query);
            if (found) {
                return formatMatch(found, 'v2');
            }
        }
    }

    return null;
}

function buildSearchQuery(name, phone, version) {
    const conditions = [];
    
    if (name) {
        conditions.push({ name: { $regex: `^${name}$`, $options: 'i' } });
    }
    
    if (phone) {
        const phoneField = version === 'v2' ? 'contactInfo.phone' : 'phone';
        conditions.push({ [phoneField]: { $regex: phone } });
    }
    
    if (conditions.length === 0) return null;
    if (conditions.length === 1) return conditions[0];
    return { $or: conditions };
}

function formatMatch(doc, posVersion) {
    return {
        id: doc._id.toString(),
        posVersion,
        name: doc.name,
        phone: posVersion === 'v2' ? doc.contactInfo?.phone : doc.phone,
        currentStartDate: posVersion === 'v2' ? doc.packageInfo?.startDate : doc.startDate,
        currentEndDate: posVersion === 'v2' ? doc.packageInfo?.endDate : doc.endDate,
        currentPeriod: doc.period,
    };
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = excelImportController;
