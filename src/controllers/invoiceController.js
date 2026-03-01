/**
 * Invoice Controller
 * 
 * Handles invoice CRUD operations and PDF generation.
 * Matches the AppZap invoice format (Lao language).
 */

const { ObjectId } = require('mongodb');
const { getRestaurantById } = require('../utils/multiDbConnection');

/**
 * Generate invoice number
 * Format: AZ-YYYYMM-XXX (e.g., AZ-202602-105)
 */
async function generateInvoiceNumber(db) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `AZ-${yearMonth}-`;

    // Find the highest invoice number for this month
    const lastInvoice = await db.collection('invoices')
        .find({ invoiceNumber: { $regex: `^${prefix}` } })
        .sort({ invoiceNumber: -1 })
        .limit(1)
        .toArray();

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
        const lastNumber = parseInt(lastInvoice[0].invoiceNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

const invoiceController = {
    /**
     * Get all invoices with filtering
     */
    getInvoices: async (req, res, db) => {
        try {
            const {
                search,
                paymentStatus,
                posVersion,
                startDate,
                endDate,
                limit = 50,
                skip = 0,
            } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { invoiceNumber: { $regex: search, $options: 'i' } },
                    { 'restaurant.name': { $regex: search, $options: 'i' } },
                ];
            }

            if (paymentStatus) {
                query.paymentStatus = paymentStatus;
            }

            if (posVersion) {
                query['restaurant.posVersion'] = posVersion;
            }

            if (startDate || endDate) {
                query.invoiceDate = {};
                if (startDate) query.invoiceDate.$gte = new Date(startDate);
                if (endDate) query.invoiceDate.$lte = new Date(endDate + 'T23:59:59.999Z');
            }

            const [invoices, total] = await Promise.all([
                db.collection('invoices')
                    .find(query)
                    .sort({ invoiceDate: -1 })
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('invoices').countDocuments(query),
            ]);

            // Calculate summary
            const allInvoices = await db.collection('invoices').find(query).toArray();
            const summary = {
                total: allInvoices.length,
                totalAmount: allInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
                byStatus: {
                    pending: allInvoices.filter(inv => inv.paymentStatus === 'pending').length,
                    paid: allInvoices.filter(inv => inv.paymentStatus === 'paid').length,
                    overdue: allInvoices.filter(inv => inv.paymentStatus === 'overdue').length,
                    cancelled: allInvoices.filter(inv => inv.paymentStatus === 'cancelled').length,
                },
            };

            res.json({
                success: true,
                data: invoices,
                pagination: { total, limit: parseInt(limit), skip: parseInt(skip) },
                summary,
            });
        } catch (error) {
            console.error('[Invoice] Error getting invoices:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get single invoice by ID
     */
    getInvoiceById: async (req, res, db) => {
        try {
            const { id } = req.params;

            const invoice = await db.collection('invoices').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!invoice) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invoice not found' 
                });
            }

            res.json({
                success: true,
                data: invoice,
            });
        } catch (error) {
            console.error('[Invoice] Error getting invoice:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create new invoice
     */
    createInvoice: async (req, res, db) => {
        try {
            const {
                restaurantId,
                posVersion,
                items,
                discount,
                freeMonths,
                subscription,
                notes,
                dueDate,
            } = req.body;

            // Validate required fields
            if (!restaurantId || !posVersion) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'restaurantId and posVersion are required' 
                });
            }

            // Get restaurant details
            const restaurant = await getRestaurantById(restaurantId, posVersion);
            if (!restaurant) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Restaurant not found' 
                });
            }

            // Generate invoice number
            const invoiceNumber = await generateInvoiceNumber(db);

            // Calculate totals
            const itemsWithTotals = (items || []).map(item => ({
                ...item,
                totalPrice: (item.quantity || 1) * (item.unitPrice || 0),
            }));

            const subtotal = itemsWithTotals.reduce((sum, item) => sum + item.totalPrice, 0);

            // Calculate discount
            let discountAmount = 0;
            if (discount) {
                if (discount.type === 'percentage') {
                    discountAmount = subtotal * (discount.value / 100);
                } else {
                    discountAmount = discount.value || 0;
                }
            }

            // Calculate free months value
            const freeMonthsValue = (freeMonths || 0) * (subscription?.monthlyRate || 0);

            // Final total
            const total = subtotal - discountAmount - freeMonthsValue;

            // Prepare invoice document
            const invoice = {
                invoiceNumber,
                invoiceDate: new Date(),
                dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days

                restaurant: {
                    id: restaurantId,
                    posVersion,
                    name: restaurant.name,
                    code: restaurant.code || null,
                    phone: restaurant.phone || restaurant.contactInfo?.phone,
                    address: posVersion === 'v1' 
                        ? `${restaurant.village || ''} ${restaurant.district || ''} ${restaurant.province || ''}`
                        : restaurant.address?.fullAddress || '',
                },

                items: itemsWithTotals,

                subtotal,
                discount: discount ? {
                    type: discount.type,
                    value: discount.value,
                    amount: discountAmount,
                } : null,
                freeMonths: freeMonths || 0,
                freeMonthsValue,
                total,
                currency: 'LAK',

                subscription: subscription ? {
                    packageName: subscription.packageName,
                    packageCode: subscription.packageCode,
                    period: subscription.period,
                    startDate: subscription.startDate ? new Date(subscription.startDate) : null,
                    endDate: subscription.endDate ? new Date(subscription.endDate) : null,
                    monthlyRate: subscription.monthlyRate,
                } : null,

                paymentStatus: 'pending',
                paymentMethod: null,
                paymentDate: null,
                paymentDetails: {
                    bankName: 'ທະນາຄານການຄ້າຕ່າງປະເທດລາວ (BCEL)',
                    accountNumber: '010-11-00192298',
                    accountName: 'LAILAO APPZAP CO.,LTD',
                    transactionId: null,
                },

                notes: notes || '',
                terms: [
                    'ລູກຄ້າຕ້ອງຊຳລະບໍ່ໃຫ້ກາຍວັນທີ ກຳນົດ',
                    'ພາຍຫຼັງຊຳລະແລ້ວ, ຜູ້ຂັດທະນາຈະມອບ ໃບເຈ້ງຮັບເງິນ ໃຫ້ລູກຄ້າ, ເພື່ອໃຊ້ເປັນຫຼັກຖານຢັ້ງຢືນໃນການຊຳລະ.',
                ],

                createdBy: req.user?.id || 'system',
                updatedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),

                pdfUrl: null,
                pdfGeneratedAt: null,
            };

            const result = await db.collection('invoices').insertOne(invoice);

            res.status(201).json({
                success: true,
                data: {
                    ...invoice,
                    _id: result.insertedId,
                },
            });
        } catch (error) {
            console.error('[Invoice] Error creating invoice:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update invoice
     */
    updateInvoice: async (req, res, db) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated directly
            delete updates._id;
            delete updates.invoiceNumber;
            delete updates.createdAt;
            delete updates.createdBy;

            updates.updatedAt = new Date();
            updates.updatedBy = req.user?.id || 'system';

            // Recalculate totals if items changed
            if (updates.items) {
                updates.items = updates.items.map(item => ({
                    ...item,
                    totalPrice: (item.quantity || 1) * (item.unitPrice || 0),
                }));
                updates.subtotal = updates.items.reduce((sum, item) => sum + item.totalPrice, 0);

                // Recalculate discount
                if (updates.discount) {
                    if (updates.discount.type === 'percentage') {
                        updates.discount.amount = updates.subtotal * (updates.discount.value / 100);
                    } else {
                        updates.discount.amount = updates.discount.value || 0;
                    }
                }

                // Recalculate total
                const discountAmount = updates.discount?.amount || 0;
                const freeMonthsValue = updates.freeMonthsValue || 0;
                updates.total = updates.subtotal - discountAmount - freeMonthsValue;
            }

            const result = await db.collection('invoices').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invoice not found' 
                });
            }

            const updatedInvoice = await db.collection('invoices').findOne({ 
                _id: new ObjectId(id) 
            });

            res.json({
                success: true,
                data: updatedInvoice,
            });
        } catch (error) {
            console.error('[Invoice] Error updating invoice:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update payment status
     */
    updatePaymentStatus: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { paymentStatus, paymentMethod, paymentDate, transactionId } = req.body;

            const invoice = await db.collection('invoices').findOne({ _id: new ObjectId(id) });
            if (!invoice) {
                return res.status(404).json({ success: false, error: 'Invoice not found' });
            }

            const updates = {
                paymentStatus,
                updatedAt: new Date(),
                updatedBy: req.user?.id || 'system',
            };

            if (paymentStatus === 'paid') {
                updates.paymentMethod = paymentMethod || 'bank_transfer';
                updates.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
                updates['paymentDetails.transactionId'] = transactionId || null;

                // TOR 4: Auto-create Income record when invoice is paid
                const incomeDoc = {
                    title: `Invoice ${invoice.invoiceNumber} - ${invoice.restaurant?.name || 'Unknown'}`,
                    description: `Payment received for invoice ${invoice.invoiceNumber}`,
                    category: 'subscription',
                    amount: invoice.total || 0,
                    currency: invoice.currency || 'LAK',
                    incomeDate: updates.paymentDate,
                    receivedDate: updates.paymentDate,
                    paymentStatus: 'received',
                    paymentMethod: updates.paymentMethod,
                    paymentReference: transactionId || invoice.invoiceNumber,
                    source: {
                        type: 'restaurant',
                        id: invoice.restaurant?.id,
                        posVersion: invoice.restaurant?.posVersion,
                        name: invoice.restaurant?.name,
                        contact: invoice.restaurant?.phone,
                    },
                    invoiceId: id,
                    invoiceNumber: invoice.invoiceNumber,
                    isRecurring: false,
                    createdBy: req.user?.id || 'system',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                await db.collection('incomes').insertOne(incomeDoc);
            }

            const result = await db.collection('invoices').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, error: 'Invoice not found' });
            }

            res.json({
                success: true,
                message: 'Payment status updated',
            });
        } catch (error) {
            console.error('[Invoice] Error updating payment status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete invoice
     */
    deleteInvoice: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('invoices').deleteOne({ 
                _id: new ObjectId(id) 
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invoice not found' 
                });
            }

            res.json({
                success: true,
                message: 'Invoice deleted',
            });
        } catch (error) {
            console.error('[Invoice] Error deleting invoice:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get invoice PDF data (for frontend PDF generation)
     * Returns formatted data that matches the AppZap invoice template
     */
    getInvoicePdfData: async (req, res, db) => {
        try {
            const { id } = req.params;

            const invoice = await db.collection('invoices').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!invoice) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invoice not found' 
                });
            }

            // Format data for PDF template (Lao language)
            const pdfData = {
                // Header
                company: {
                    name: 'ບໍລິສັດ ລາຍລາວແອັບແຊບ ຈຳກັດ',
                    address: 'ທີ່ຕັ້ງ : ບ້ານ ໂນນຄໍ້ໄຕ້, ເມືອງ ໄຊເສດຖາ, ນະຄອນຫຼວງວຽງຈັນ',
                    phone: 'ເບີໂທ : +856-20-5863-5474',
                    email: 'ອີເມວ : info@appzap.la',
                },

                // Invoice info
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: formatDateLao(invoice.invoiceDate),
                title: 'ໃບແຈ້ງຈ່າຍເງິນ',
                subtitle: 'ຫົວຂໍ້ : ລະບົບຈັດການຮ້ານອາຫານແລະ ອຸປະກອນ',

                // Customer info
                customer: {
                    name: invoice.restaurant.name,
                    representative: '', // Can be filled later
                    phone: invoice.restaurant.phone,
                },

                // Items table
                itemsTitle: 'ລາຍລະອຽດມູນຄ່າ',
                tableHeaders: {
                    no: 'ລຳດັບ',
                    description: 'ເນື້ອໃນລາຍການ',
                    price: 'ລາຄາ(ກີບ)',
                    note: 'ໝາຍເຫດ',
                },
                items: invoice.items.map((item, index) => ({
                    no: index + 1,
                    description: item.description,
                    price: formatNumberLao(item.totalPrice),
                    note: item.note || '',
                })),

                // Total
                totalLabel: 'ລາຄາລວມທັງໝົດ',
                total: formatNumberLao(invoice.total),

                // Payment info
                paymentTitle: 'ລາຍລະອຽດຖ່າຍທາງການຊຳລະແມ່ນຊຳລະຜ່ານການໂອນເຂົ້າບັນຊີເງິນຝາກຂອງຜູ້ບໍລິການດັ່ງນີ້:',
                payment: {
                    bankLabel: 'ຊື່ທະນາຄານ:',
                    bankName: invoice.paymentDetails.bankName,
                    accountLabel: 'ເລກບັນຊີ(ກີບ):',
                    accountNumber: invoice.paymentDetails.accountNumber,
                    nameLabel: 'ຊື່ບັນຊີ:',
                    accountName: invoice.paymentDetails.accountName,
                },

                // Terms
                termsTitle: '* ໝາຍເຫດ:',
                terms: invoice.terms,

                // Footer
                signature: {
                    company: 'ບໍລິສັດ ລາຍລາວແອັບແຊບ ຈຳກັດ',
                    name: 'ມີກຸ ກໍ່ລວັນປະຈວ',
                },

                // QR Code data (for payment)
                qrData: {
                    bankCode: 'BCEL',
                    accountNumber: invoice.paymentDetails.accountNumber,
                    amount: invoice.total,
                    reference: invoice.invoiceNumber,
                },

                // Raw data for calculations
                raw: invoice,
            };

            res.json({
                success: true,
                data: pdfData,
            });
        } catch (error) {
            console.error('[Invoice] Error getting PDF data:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get subscription packages for invoice creation
     */
    getSubscriptionPackages: async (req, res, db) => {
        try {
            const packages = await db.collection('subscriptionPackages')
                .find({ isActive: true })
                .sort({ sortOrder: 1 })
                .toArray();

            res.json({
                success: true,
                data: packages,
            });
        } catch (error) {
            console.error('[Invoice] Error getting packages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

// Helper functions
function formatDateLao(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatNumberLao(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-US');
}

module.exports = invoiceController;
