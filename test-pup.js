const puppeteer = require('puppeteer');

(async () => {
    console.log('Bắt đầu mở trình duyệt...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    console.log('Đang truy cập SPX...');
    await page.goto('https://spx.vn/track?VN261188053469C', { waitUntil: 'networkidle2' });
    
    // Đợi 2 giây cho render
    await new Promise(r => setTimeout(r, 2000));
    
    // In toàn bộ text ra để xem cấu trúc
    const text = await page.evaluate(() => document.body.innerText);
    console.log('NỘI DUNG:', text);
    
    await browser.close();
})();
