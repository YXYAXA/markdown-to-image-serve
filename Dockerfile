# 使用官方 Node.js 镜像作为基础镜像
FROM node:20-alpine

# 更新 apk 并安装 Chromium 及其依赖
RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 如果 Puppeteer 默认会下载 Chromium，这里强制使用系统安装的版本
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# 根据你的情况设置 CHROME_PATH，建议先确认容器内实际路径：
# 如果容器内 Chromium 路径为 /usr/bin/chromium-browser，则使用它；
# 如果为 /usr/bin/chromium，请修改为 /usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium-browser

# 设置工作目录
WORKDIR /app

# 复制依赖相关文件
COPY package*.json ./
COPY .env* ./
COPY . .
# 安装依赖并构建
RUN npm install && npm run build

# 复制其他源代码


# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
