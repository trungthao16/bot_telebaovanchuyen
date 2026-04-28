FROM ghcr.io/puppeteer/puppeteer:latest
WORKDIR /app
# Copy thư mục hiện tại vào container
COPY package*.json ./
# Cài đặt các thư viện
RUN npm install
# Copy toàn bộ code (trừ các file trong .gitignore)
COPY . .
# Lệnh khởi chạy
CMD ["npm", "start"]
