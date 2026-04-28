const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true,
    },
    trackingCode: {
        type: String,
        required: true,
    },
    lastStatus: {
        type: String,
        default: 'Đang chờ cập nhật',
    },
    isCompleted: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Order', orderSchema);
