require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const connectDB = require('./database');
const Order = require('./models/Order');
const { getSPXTrackingInfo } = require('./services/trackingService');
const express = require('express');

// Khởi tạo máy chủ Web ảo để chống "ngủ" (Keep-alive) trên Render
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot SPX Tracking Đang Chạy 24/24!'));
app.listen(port, () => console.log(`🚀 Web server giữ nhịp đang chạy trên cổng ${port}`));

connectDB();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Bot Telegram đã khởi động và đang lắng nghe...');

bot.setMyCommands([
    { command: '/start', description: 'Mở Menu điều khiển' }
]);

// Bàn phím ảo chính (Main Menu) với tất cả chức năng
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📋 Danh sách đơn hàng' }, { text: '🗑️ Hủy theo dõi mã' }],
            [{ text: 'ℹ️ Hướng dẫn sử dụng' }]
        ],
        resize_keyboard: true,
        is_persistent: true
    }
};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📦 *Hệ Thống Theo Dõi Đơn Hàng SPX*\n\n👇 Hãy sử dụng các nút bấm dưới đây để quản lý.\n👉 Để thêm mã mới, bạn chỉ cần gõ mã và gửi lên đây!', { 
        parse_mode: 'Markdown',
        ...mainKeyboard
    });
});

// Xử lý nút: Danh sách đơn
const handleListCommand = async (chatId) => {
    const orders = await Order.find({ chatId });
    if (orders.length === 0) {
        return bot.sendMessage(chatId, '📭 Bạn chưa theo dõi mã nào. Hãy dán mã vận đơn vào đây để bắt đầu.', mainKeyboard);
    }

    const buttons = orders.map(order => {
        return [{ 
            text: `📦 ${order.trackingCode} ${order.isCompleted ? '(Đã giao)' : ''}`, 
            callback_data: `recheck_${order.trackingCode}` 
        }];
    });

    bot.sendMessage(chatId, '📋 *Danh sách đơn hàng của bạn:*\n(Bấm vào nút bên dưới để tra cứu trạng thái mới nhất)', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
};

// Xử lý nút: Xóa mã
const handleDeleteMenuCommand = async (chatId) => {
    const orders = await Order.find({ chatId });
    if (orders.length === 0) {
        return bot.sendMessage(chatId, '📭 Bạn chưa theo dõi mã nào để xóa.', mainKeyboard);
    }

    const buttons = orders.map(order => {
        return [{ 
            text: `❌ Xóa mã ${order.trackingCode}`, 
            callback_data: `delete_${order.trackingCode}` 
        }];
    });

    bot.sendMessage(chatId, '🗑️ *Bạn muốn ngừng theo dõi mã nào?*\n(Bấm vào nút để xóa thẳng tay)', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
};

// Xử lý thêm mã mới
const handleTrackOrder = async (chatId, trackingCode) => {
    try {
        bot.sendMessage(chatId, `⏳ Đang kiểm tra mã ${trackingCode}...`);

        const existingOrder = await Order.findOne({ chatId, trackingCode });
        if (existingOrder) {
            return bot.sendMessage(chatId, `⚠️ Bạn đã theo dõi mã *${trackingCode}* rồi.\nTrạng thái hiện tại: *${existingOrder.lastStatus}*`, { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔄 Tra cứu lại ngay', callback_data: `recheck_${trackingCode}` }]]
                }
            });
        }

        const trackingInfo = await getSPXTrackingInfo(trackingCode);
        const initialStatus = trackingInfo.success ? trackingInfo.status : trackingInfo.message;

        const newOrder = new Order({
            chatId,
            trackingCode,
            lastStatus: initialStatus,
            isCompleted: initialStatus.toLowerCase().includes('đã giao thành công')
        });
        await newOrder.save();

        bot.sendMessage(chatId, `✅ *Đăng ký thành công!*\n📦 Mã: ${trackingCode}\n📊 Trạng thái hiện tại:\n*${initialStatus}*\n\nTôi sẽ nhắn tin tự động khi có cập nhật mới!`, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔄 Tra cứu lại ngay', callback_data: `recheck_${trackingCode}` }]]
            }
        });
    } catch (error) {
        bot.sendMessage(chatId, '❌ Đã xảy ra lỗi hệ thống khi đăng ký mã.');
    }
};

// Bắt mọi tin nhắn chữ (Menu hoặc Mã mới)
bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const text = msg.text.trim();
        
        // Kiểm tra xem có phải người dùng bấm nút Menu không
        if (text === '📋 Danh sách đơn hàng') {
            return handleListCommand(msg.chat.id);
        } else if (text === '🗑️ Hủy theo dõi mã') {
            return handleDeleteMenuCommand(msg.chat.id);
        } else if (text === 'ℹ️ Hướng dẫn sử dụng') {
            return bot.sendMessage(msg.chat.id, '📝 *Hướng dẫn:*\n- Nhắn trực tiếp mã vận đơn SPX vào ô chat để bot bắt đầu theo dõi.\n- Bấm nút *Danh sách* để xem các mã.\n- Bấm nút *Hủy theo dõi* để xóa các mã đã nhận được hàng.', { parse_mode: 'Markdown' });
        }

        // Nếu không phải nút bấm, coi như đó là mã vận đơn
        const trackingCode = text.toUpperCase();
        if (/^[A-Z0-9]+$/.test(trackingCode)) {
            handleTrackOrder(msg.chat.id, trackingCode);
        } else {
            bot.sendMessage(msg.chat.id, '❌ Tin nhắn không hợp lệ. Vui lòng bấm các nút chức năng hoặc nhập đúng mã vận đơn.', mainKeyboard);
        }
    }
});

// XỬ LÝ SỰ KIỆN KHI BẤM NÚT INLINE (Tra cứu lại / Xóa)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data; 

    // Nút: Tra cứu lại
    if (data.startsWith('recheck_')) {
        const trackingCode = data.replace('recheck_', '');
        bot.answerCallbackQuery(query.id, { text: `Đang kiểm tra lại ${trackingCode}...` });
        
        const trackingInfo = await getSPXTrackingInfo(trackingCode);
        const currentStatus = trackingInfo.success ? trackingInfo.status : trackingInfo.message;
        
        await Order.findOneAndUpdate({ chatId, trackingCode }, { 
            lastStatus: currentStatus,
            isCompleted: currentStatus.toLowerCase().includes('đã giao thành công')
        });

        bot.sendMessage(chatId, `🔄 *KẾT QUẢ CẬP NHẬT*\n📦 Mã: ${trackingCode}\n📊 Trạng thái hiện tại:\n*${currentStatus}*`, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔄 Tra cứu lại ngay', callback_data: `recheck_${trackingCode}` }]]
            }
        });
    }
    
    // Nút: Xóa mã
    else if (data.startsWith('delete_')) {
        const trackingCode = data.replace('delete_', '');
        await Order.findOneAndDelete({ chatId, trackingCode });
        
        bot.answerCallbackQuery(query.id, { text: `Đã xóa mã ${trackingCode}` });
        
        // Đổi nội dung tin nhắn đó thành thông báo đã xóa (ẩn các nút đi)
        bot.editMessageText(`🗑️ Đã ngừng theo dõi mã: *${trackingCode}*`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// --- THIẾT LẬP CRON JOB TỰ ĐỘNG ---
// Chạy quét tự động 3 tiếng 1 lần (để tránh bị Shopee chặn và đỡ nặng máy)
cron.schedule('0 */3 * * *', async () => {
    console.log('🔄 Bắt đầu chạy quét kiểm tra trạng thái đơn hàng (Định kỳ 3 tiếng/lần)...');
    try {
        const activeOrders = await Order.find({ isCompleted: false });
        for (const order of activeOrders) {
            const trackingInfo = await getSPXTrackingInfo(order.trackingCode);
            if (trackingInfo.success && trackingInfo.status !== order.lastStatus) {
                order.lastStatus = trackingInfo.status;
                if (trackingInfo.status.toLowerCase().includes('đã giao thành công')) {
                    order.isCompleted = true;
                }
                await order.save();
                bot.sendMessage(order.chatId, `🔔 *CẬP NHẬT ĐƠN HÀNG* 🔔\n📦 Mã: ${order.trackingCode}\n➡️ Trạng thái mới: *${trackingInfo.status}*`, { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔄 Tra cứu lại ngay', callback_data: `recheck_${order.trackingCode}` }]]
                    }
                });
            }
        }
    } catch (error) {
        console.error('Lỗi khi chạy cron job:', error);
    }
});
