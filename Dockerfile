# 使用官方 Node.js 镜像作为基础镜像
FROM node:20-alpine

# 更新 apk 并安装 Chromium 浏览器
RUN apk update && apk add --no-cache chromium

# 设置 CHROME_PATH 环境变量，指向 Chromium 可执行文件
ENV CHROME_PATH=/usr/bin/chromium-browser

# 设置工作目录
WORKDIR /app

# 首先复制依赖相关文件
COPY package*.json ./
COPY .env* ./
COPY . .
# 安装依赖并构建
RUN npm install && npm run build

# 然后再复制其他源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
