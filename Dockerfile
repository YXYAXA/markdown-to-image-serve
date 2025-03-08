# 使用官方 Node.js 镜像作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 更新 apk 并安装 Chromium 及其依赖
RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# 使用系统安装的 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
ENV NEXT_PUBLIC_BASE_URL=https://md.yuychat.cn
# 首先复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用程序代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 使用 dumb-init 作为入口点处理 Docker 信号
ENTRYPOINT ["dumb-init", "--"]

# 启动命令
CMD ["npm", "start"]
