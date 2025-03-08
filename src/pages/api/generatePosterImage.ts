/*
 * @Author: wxingheng
 * @Date: 2024-11-28 14:20:13
 * @LastEditTime: 2025-03-08 18:19:27
 * @LastEditors: wxingheng
 * @Description: 生成海报; 返回海报图片 url
 * @FilePath: /markdown-to-image-serve/src/pages/api/generatePosterImage.ts
 */
import { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

// 配置为 Vercel 无服务器函数
export const config = {
  maxDuration: 60, // 增加最大执行时间到60秒
  api: {
    bodyParser: {
      sizeLimit: '4mb', // 增加请求体大小限制
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "只支持 POST 请求" });
  }
  
  try {
    const { markdown } = req.body;
    
    if (!markdown) {
      return res.status(400).json({ error: "缺少必要的 markdown 参数" });
    }

    // 设置更加严格的超时控制
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("操作超时，请尝试减少内容或优化图片")), 50000);
    });

    // 启动浏览器配置优化
    const browserPromise = puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 1200, height: 1600, deviceScaleFactor: 1 },
      executablePath: process.env.NODE_ENV === 'production' 
        ? await chromium.executablePath(`https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar`) 
        : process.env.CHROME_PATH,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    // 使用 Promise.race 确保不会无限等待
    const browser = await Promise.race([browserPromise, timeoutPromise]) as any;
    
    // 优化页面加载设置
    const page = await browser.newPage();
    
    // 优化性能设置
    await page.setCacheEnabled(true);
    await page.setRequestInterception(true);
    
    // 拦截非必要资源
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['stylesheet', 'font', 'image'].includes(resourceType)) {
        request.continue();
      } else if (['media', 'other'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // 获取基础 URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
    );
    
    // 更好地处理 URL 参数编码
    const safeMarkdown = encodeURIComponent(markdown);
    const url = `/poster?content=${safeMarkdown}`;
    const fullUrl = `${baseUrl}${url}`;
    
    // 设置导航超时
    await page.goto(fullUrl, { 
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000 
    });

    // 减少等待时间，使用可见性而不是存在性
    await page.waitForSelector(".poster-content", { 
      visible: true,
      timeout: 10000 
    });
    
    // 优化图片加载等待
    await Promise.race([
      page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise(resolve => {
              img.onload = img.onerror = resolve;
            }))
        );
      }),
      new Promise(resolve => setTimeout(resolve, 5000)) // 最多等待 5 秒
    ]);
    
    // 获取元素
    const element = await page.$(".poster-content");
    if (!element) {
      throw new Error("找不到海报元素");
    }
    
    // 获取元素的边界框
    const box = await element.boundingBox();
    if (!box) {
      throw new Error("无法获取元素边界");
    }
    
    // 生成唯一文件名，使用更短的名称
    const fileName = `p-${Date.now()}.png`;
    
    // 直接使用 Base64 编码返回图片，不再保存到文件系统
    const screenshotBuffer = await page.screenshot({
      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      encoding: "binary"
    });
    
    // 关闭浏览器以释放资源
    await browser.close();
    
    // 将图片数据保存为 base64 并直接返回
    const base64Image = Buffer.from(screenshotBuffer).toString('base64');
    
    // 返回 base64 数据 URL，不再需要通过文件系统
    res.status(200).json({ 
      url: `data:image/png;base64,${base64Image}`,
      type: "base64"
    });
  } catch (error) {
    console.error("生成海报错误:", error);
    
    // 提供更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : "生成海报失败";
    res.status(500).json({ 
      error: errorMessage,
      hint: "可能是内容过大或图片过多导致处理超时，请尝试减少内容或图片数量"
    });
  }
}
