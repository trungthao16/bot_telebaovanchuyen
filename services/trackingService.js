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
        
        // Tối ưu tốc độ tải: Chỉ chặn hình ảnh và font chữ (GIỮ LẠI CSS) để web load siêu nhanh mà không lỗi giao diện
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });
        
        // Đổi thành domcontentloaded để tránh bị kẹt timeout 60s do các script phân tích của Shopee
        await page.goto(`https://spx.vn/track?${trackingCode}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Cho Shopee hẳn 10 giây để kéo dữ liệu API và hiển thị lên màn hình
        await new Promise(r => setTimeout(r, 10000));

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
        
        // In log raw data để kiểm tra trên máy chủ Render
        console.log("=> Raw Data:", trackingData.substring(0, 400).replace(/\n/g, ' | '));

        // Phân tích trạng thái bằng biểu thức chính quy (Regex)
        // Định dạng cần tìm: 14:35:46 \n 18 Apr 2026 \n Trạng thái...
        const regex = /(\d{2}:\d{2}:\d{2})\s+(\d{2} [a-zA-Z]{3} \d{4})\s+([^\n]+)/;
        const match = trackingData.match(regex);
        
        if (match) {
            const time = match[1];
            const date = match[2];
            const statusText = match[3].trim();
            const status = `${statusText} (${time} ${date})`;

            console.log(`=> Lấy thành công: ${status}`);
            console.log(`=============================================\n`);

            return {
                success: true,
                status: status,
                message: "Thành công"
            };
        } else {
            console.log("=> Không tìm thấy thời gian trong chuỗi!");
            console.log(`=============================================\n`);
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
