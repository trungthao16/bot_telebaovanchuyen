const puppeteer = require('puppeteer');

const getSPXTrackingInfo = async (trackingCode) => {
    let browser;
    try {
        console.log(`\n=============================================`);
        console.log(`🤖 ĐANG CÀO DỮ LIỆU TỪ SPX (Mã: ${trackingCode})`);
        
        browser = await puppeteer.launch({ 
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
        });
        const page = await browser.newPage();
        
        // Tối ưu tốc độ: Chặn tải hình ảnh, font và CSS vì bot chỉ cần đọc Text
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });
        
        // Tăng timeout lên 60 giây vì máy chủ miễn phí xử lý khá chậm
        await page.goto(`https://spx.vn/track?${trackingCode}`, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Đợi 2 giây cho giao diện render xong dữ liệu
        await new Promise(r => setTimeout(r, 2000));

        // Lấy text hiển thị
        const trackingData = await page.evaluate(() => document.body.innerText);
        await browser.close();

        // Kiểm tra mã không tồn tại
        if (trackingData.includes('Không tìm thấy') || trackingData.includes('Mã vận đơn không hợp lệ')) {
            return {
                success: false,
                status: null,
                message: "Mã vận đơn không tồn tại hoặc sai định dạng."
            };
        }
        
        // Phân tích trạng thái
        const parts = trackingData.split('Đã giao hàng');
        if (parts.length > 1) {
            const rawLog = parts[1].split('Đăng nhập')[0].trim();
            // Tách thành các dòng
            const lines = rawLog.split('\n').map(l => l.trim()).filter(l => l !== '');
            
            // lines thường có dạng: ['14:35:46', '18 Apr 2026', 'Giao hàng thành công', ...]
            let status = '';
            if (lines.length >= 3) {
                // Trạng thái mới nhất nằm ở index 2
                status = `${lines[2]} (${lines[0]} ${lines[1]})`;
            } else {
                status = trackingData.includes('Giao hàng thành công') ? 'Giao hàng thành công' : 'Đang cập nhật lịch trình...';
            }

            console.log(`=> Lấy thành công: ${status}`);
            console.log(`=============================================\n`);

            return {
                success: true,
                status: status,
                message: "Thành công"
            };
        } else {
            return {
                success: true,
                status: 'Chưa có thông tin lịch trình (Chờ lấy hàng)',
                message: "Thành công"
            };
        }

    } catch (error) {
        if (browser) await browser.close();
        console.error(`[LỖI CÀO DỮ LIỆU]:`, error.message);
        return {
            success: false,
            status: null,
            message: "Lỗi kết nối hoặc Shopee đang chặn. Vui lòng thử lại sau."
        };
    }
};

module.exports = {
    getSPXTrackingInfo
};
