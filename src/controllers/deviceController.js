/**
 * Device Controller
 * 
 * Manages inventory of devices (printers, cash drawers, tablets, etc.)
 */

const { ObjectId } = require('mongodb');

const deviceController = {
    /**
     * Get all devices with filtering
     */
    getDevices: async (req, res, db) => {
        try {
            const {
                search,
                type,
                status,
                limit = 50,
                skip = 0,
            } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { serialNumber: { $regex: search, $options: 'i' } },
                    { model: { $regex: search, $options: 'i' } },
                    { brand: { $regex: search, $options: 'i' } },
                    { 'assignedTo.restaurantName': { $regex: search, $options: 'i' } },
                ];
            }

            if (type) {
                query.type = type;
            }

            if (status) {
                query.status = status;
            }

            const [devices, total] = await Promise.all([
                db.collection('devices')
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('devices').countDocuments(query),
            ]);

            // Calculate summary
            const allDevices = await db.collection('devices').find({}).toArray();
            const summary = {
                total: allDevices.length,
                byType: {},
                byStatus: {
                    available: 0,
                    sold: 0,
                    reserved: 0,
                    defective: 0,
                    returned: 0,
                },
                totalValue: 0,
            };

            allDevices.forEach(device => {
                // By type
                if (!summary.byType[device.type]) {
                    summary.byType[device.type] = 0;
                }
                summary.byType[device.type]++;

                // By status
                if (summary.byStatus[device.status] !== undefined) {
                    summary.byStatus[device.status]++;
                }

                // Total value (available only)
                if (device.status === 'available') {
                    summary.totalValue += device.sellingPrice || 0;
                }
            });

            res.json({
                success: true,
                data: devices,
                pagination: { total, limit: parseInt(limit), skip: parseInt(skip) },
                summary,
            });
        } catch (error) {
            console.error('[Device] Error getting devices:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get single device by ID
     */
    getDeviceById: async (req, res, db) => {
        try {
            const { id } = req.params;

            const device = await db.collection('devices').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!device) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Device not found' 
                });
            }

            res.json({
                success: true,
                data: device,
            });
        } catch (error) {
            console.error('[Device] Error getting device:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create new device
     */
    createDevice: async (req, res, db) => {
        try {
            const {
                serialNumber,
                type,
                model,
                brand,
                description,
                purchasePrice,
                sellingPrice,
                warranty,
                notes,
            } = req.body;

            // Validate required fields
            if (!serialNumber || !type) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'serialNumber and type are required' 
                });
            }

            // Check if serial number already exists
            const existing = await db.collection('devices').findOne({ serialNumber });
            if (existing) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Device with this serial number already exists' 
                });
            }

            const device = {
                serialNumber,
                type, // "printer" | "cash_drawer" | "tablet" | "scanner" | "other"
                model: model || '',
                brand: brand || '',
                description: description || '',

                purchasePrice: purchasePrice || 0,
                sellingPrice: sellingPrice || 0,
                currency: 'LAK',

                status: 'available',

                assignedTo: null,

                warranty: warranty ? {
                    months: warranty.months || 0,
                    startDate: null,
                    endDate: null,
                } : null,

                notes: notes || '',

                createdBy: req.user?.id || 'system',
                updatedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('devices').insertOne(device);

            res.status(201).json({
                success: true,
                data: {
                    ...device,
                    _id: result.insertedId,
                },
            });
        } catch (error) {
            console.error('[Device] Error creating device:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update device
     */
    updateDevice: async (req, res, db) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated directly
            delete updates._id;
            delete updates.createdAt;
            delete updates.createdBy;

            updates.updatedAt = new Date();
            updates.updatedBy = req.user?.id || 'system';

            const result = await db.collection('devices').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Device not found' 
                });
            }

            const updatedDevice = await db.collection('devices').findOne({ 
                _id: new ObjectId(id) 
            });

            res.json({
                success: true,
                data: updatedDevice,
            });
        } catch (error) {
            console.error('[Device] Error updating device:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Assign device to restaurant (when sold)
     */
    assignDevice: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { restaurantId, posVersion, restaurantName, invoiceId } = req.body;

            // Validate
            if (!restaurantId || !posVersion) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'restaurantId and posVersion are required' 
                });
            }

            // Get device
            const device = await db.collection('devices').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!device) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Device not found' 
                });
            }

            if (device.status !== 'available' && device.status !== 'reserved') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Device is not available for assignment' 
                });
            }

            // Calculate warranty dates if applicable
            let warranty = device.warranty;
            if (warranty && warranty.months > 0) {
                const startDate = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + warranty.months);
                warranty = {
                    ...warranty,
                    startDate,
                    endDate,
                };
            }

            const updates = {
                status: 'sold',
                assignedTo: {
                    restaurantId,
                    posVersion,
                    restaurantName: restaurantName || '',
                    invoiceId: invoiceId || null,
                    assignedDate: new Date(),
                },
                warranty,
                updatedAt: new Date(),
                updatedBy: req.user?.id || 'system',
            };

            await db.collection('devices').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            res.json({
                success: true,
                message: 'Device assigned successfully',
            });
        } catch (error) {
            console.error('[Device] Error assigning device:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Return device (unassign)
     */
    returnDevice: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const device = await db.collection('devices').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!device) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Device not found' 
                });
            }

            const updates = {
                status: 'returned',
                notes: device.notes + `\n[${new Date().toISOString()}] Returned: ${reason || 'No reason provided'}`,
                updatedAt: new Date(),
                updatedBy: req.user?.id || 'system',
            };

            await db.collection('devices').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            res.json({
                success: true,
                message: 'Device marked as returned',
            });
        } catch (error) {
            console.error('[Device] Error returning device:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete device
     */
    deleteDevice: async (req, res, db) => {
        try {
            const { id } = req.params;

            const device = await db.collection('devices').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!device) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Device not found' 
                });
            }

            if (device.status === 'sold') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Cannot delete a sold device' 
                });
            }

            await db.collection('devices').deleteOne({ _id: new ObjectId(id) });

            res.json({
                success: true,
                message: 'Device deleted',
            });
        } catch (error) {
            console.error('[Device] Error deleting device:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get available devices for selection in invoice
     */
    getAvailableDevices: async (req, res, db) => {
        try {
            const { type } = req.query;

            const query = { status: 'available' };
            if (type) {
                query.type = type;
            }

            const devices = await db.collection('devices')
                .find(query)
                .sort({ type: 1, model: 1 })
                .toArray();

            res.json({
                success: true,
                data: devices,
            });
        } catch (error) {
            console.error('[Device] Error getting available devices:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get device types summary
     */
    getDeviceTypes: async (req, res, db) => {
        try {
            const types = [
                { value: 'printer', label: 'Thermal Printer', labelLao: 'ເຄື່ອງພິມ', icon: '🖨️' },
                { value: 'cash_drawer', label: 'Cash Drawer', labelLao: 'ລິ້ນຊັກເງິນ', icon: '💵' },
                { value: 'tablet', label: 'Tablet', labelLao: 'ແທັບເລັດ', icon: '📱' },
                { value: 'scanner', label: 'Barcode Scanner', labelLao: 'ເຄື່ອງສະແກນ', icon: '📷' },
                { value: 'other', label: 'Other', labelLao: 'ອື່ນໆ', icon: '📦' },
            ];

            res.json({
                success: true,
                data: types,
            });
        } catch (error) {
            console.error('[Device] Error getting device types:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = deviceController;
