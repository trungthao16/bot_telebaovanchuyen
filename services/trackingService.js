const puppeteer = require('puppeteer');

const getSPXTrackingInfo = async (trackingCode) => {
    let browser;
    try {
        console.log(`\n=============================================`);
        console.log(`🤖 ĐANG CÀO DỮ LIỆU TỪ SPX (Mã: ${trackingCode})`);
        
        browser = await puppeteer.launch({ 
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        
        // Giả lập làm trình duyệt máy tính người thật để vượt qua bức tường lửa chặn Bot của Shopee
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Đi tới trang và chờ 60s
        await page.goto(`https://spx.vn/track?${trackingCode}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Chờ cho đến khi Shopee thực sự hiện chữ lên màn hình (React render thành công)
        try {
            await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 20000 });
        } catch (e) {
            console.log("=> Lỗi: Quá 20s nhưng giao diện vẫn trắng tinh!");
        }

        // Lấy text hiển thị
        const trackingData = await page.evaluate(() => document.body.innerText);
        
        // Bắt lỗi trang trắng nếu Shopee chặn truy cập
        if (!trackingData.trim()) {
            console.log("=> Lỗi: Trang web trả về trắng. HTML:", (await page.content()).substring(0, 300));
        }
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
