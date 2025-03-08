/*
 * @Author: wxingheng
 * @Date: 2024-11-28 14:20:13
 * @LastEditTime: 2025-03-08 10:00:00
 * @LastEditors: wxingheng
 * @Description: 生成海报; 返回海报图片 url
 * @FilePath: /markdown-to-image-serve/src/pages/api/generatePosterImage.ts
 */
import { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "只支持 POST 请求" });
  }
  
  try {
    const { markdown } = req.body;
    
    // 修改 Chromium 配置逻辑
    let executablePath: string;
    let args: string[] = [];
    let headless: boolean | 'new' = true;
    
    if (process.env.NODE_ENV === 'production') {
      // 在 Render 平台，使用 @sparticuz/chromium-min 和特定配置
      executablePath = await chromium.executablePath();
      // 确保 chromium.args 存在
      if (chromium.args) {
        args = chromium.args;
      } else {
        args = ['--no-sandbox', '--disable-setuid-sandbox'];
      }
      // 使用默认值，以防 chromium.headless 不存在
      headless = chromium.headless !== undefined ? chromium.headless : true;
    } else {
      // 本地开发环境
      executablePath = process.env.CHROME_PATH || '/usr/bin/chromium-browser';
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }
    
    console.log('Using Chrome executable path:', executablePath);
    console.log('Using Chrome args:', args);
    
    // 启动浏览器，修改配置选项
    const browser = await puppeteer.launch({
      args: args,
      executablePath: executablePath,
      headless: headless,
      ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    
    // 设置视口大小
    await page.setViewport({ width: 1200, height: 1600 });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const url = `/poster?content=${encodeURIComponent(markdown)}`;
    const fullUrl = `${baseUrl}${url}`;
    
    console.log('Navigating to:', fullUrl);
    
    // 导航到海报页面
    await page.goto(fullUrl, { waitUntil: 'networkidle0' });
    
    // 添加更多日志以便调试
    console.log('Page loaded, waiting for poster-content selector');
    
    // 等待海报元素渲染完成
    await page.waitForSelector(".poster-content", { timeout: 15000 });
    
    console.log('Poster content selector found');
    
    // 等待所有图片加载完成
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve;
          }))
      );
    });
    
    console.log('All images loaded');
    
    // 获取元素
    const element = await page.$(".poster-content");
    if (!element) {
      throw new Error("Poster element not found");
    }
    
    // 获取元素的边界框
    const box = await element.boundingBox();
    if (!box) {
      throw new Error("Could not get element bounds");
    }
    
    // 生成唯一文件名
    const fileName = `poster-${Date.now()}.png`;
    
    // 在 Render 上使用 /tmp 目录
    const saveDir = process.env.NODE_ENV === 'production' 
      ? path.join('/tmp', 'uploads', 'posters')
      : path.join(process.cwd(), "public", "uploads", "posters");
    
    const savePath = path.join(saveDir, fileName);
    
    console.log('Saving screenshot to:', savePath);
    
    // 确保目录存在
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    
    // 只截取特定元素
    await page.screenshot({
      path: savePath,
      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
    });
    
    console.log('Screenshot taken successfully');
    
    await browser.close();
    
    // 返回可访问的URL
    const imageUrl = process.env.NODE_ENV === 'production'
      ? `/api/images/${fileName}` // 新的 API 路由来处理图片
      : `/uploads/posters/${fileName}`;
    
    res.status(200).json({ url: `${baseUrl}${imageUrl}` });
  } catch (error: unknown) {
    console.error("生成海报出错:", error);
    
    // 修复类型错误：正确处理 unknown 类型的错误
    const errorMessage = error instanceof Error 
      ? error.message 
      : '未知错误';
      
    res.status(500).json({ 
      error: "Failed to generate poster", 
      details: errorMessage 
    });
  }
}
