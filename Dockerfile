FROM ghcr.io/puppeteer/puppeteer:latest
# Cấp quyền admin để không bị lỗi permission khi cài đặt thư viện
USER root
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
