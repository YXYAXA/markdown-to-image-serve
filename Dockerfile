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
    dumb-init \
    fontconfig

# 安装中文字体支持（如果需要处理中文内容）
RUN mkdir -p /usr/share/fonts/chinese
# 使用 shell 执行命令来处理可能不存在的文件
RUN if [ -d "./fonts" ]; then cp -r ./fonts/* /usr/share/fonts/chinese/ || true; fi
RUN fc-cache -fv

# 设置环境变量
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser
# 告诉应用程序我们已在系统中安装了Chromium
ENV USE_SYSTEM_CHROMIUM=true

# 首先复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖，包括开发依赖
RUN npm install

# 复制应用程序代码
COPY . .

# 构建应用
RUN npm run build

# 设置为生产环境
ENV NODE_ENV=production

# 创建临时目录用于存储图片
RUN mkdir -p /tmp/uploads/posters && chmod -R 777 /tmp

# 暴露端口
EXPOSE 3000

# 使用 dumb-init 作为入口点处理 Docker 信号
ENTRYPOINT ["dumb-init", "--"]

# 启动命令
CMD ["npm", "start"]
