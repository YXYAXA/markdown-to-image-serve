/*
 * @Author: wxingheng
 * @Date: 2024-11-28 14:20:13
 * @LastEditTime: 2025-02-26 18:19:27
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

    // 确保在生产环境下正确配置Chromium
    const executablePath = process.env.NODE_ENV === 'production'
      ? await chromium.executablePath()  // 不指定版本，使用最新版本
      : process.env.CHROME_PATH || '/usr/bin/chromium-browser';

    // 启动浏览器
    const browser = await puppeteer.launch({
      args: chromium.args,  // 始终使用chromium推荐的参数
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: true,  // 明确设置为true而不是依赖chromium.headless
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // 设置视口大小
    await page.setViewport({ width: 1200, height: 1600 });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const url = `/poster?content=${encodeURIComponent(markdown)}`;
    const fullUrl = `${baseUrl}${url}`;
    
    // 导航到海报页面
    await page.goto(fullUrl, { waitUntil: 'networkidle0' });
    
    // 等待海报元素渲染完成
    await page.waitForSelector(".poster-content", { timeout: 10000 });
    
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
    
    // 保存路径 - 在Render上使用/tmp目录
    const saveDir = process.env.NODE_ENV === 'production' 
      ? path.join('/tmp', 'uploads', 'posters')
      : path.join(process.cwd(), "public", "uploads", "posters");
    
    const savePath = path.join(saveDir, fileName);
    
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
