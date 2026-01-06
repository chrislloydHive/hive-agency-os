import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';

/**
 * Get browser executable path and args for the current environment
 *
 * In serverless (Vercel/AWS Lambda), uses @sparticuz/chromium
 * In local development, uses system Chrome or Puppeteer's bundled Chrome
 */
async function getBrowserConfig(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean | 'shell';
}> {
  // Check if we're in a serverless environment (Vercel, AWS Lambda)
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV;

  if (isServerless) {
    // Use @sparticuz/chromium for serverless
    try {
      const chromium = await import('@sparticuz/chromium');
      const executablePath = await chromium.default.executablePath();

      return {
        executablePath,
        args: chromium.default.args,
        headless: true, // Always headless in serverless
      };
    } catch (error) {
      console.error('[html-fetch] Failed to load @sparticuz/chromium:', error);
      throw new Error('Serverless Chromium not available. Install @sparticuz/chromium.');
    }
  }

  // Local development - try common Chrome paths
  const possiblePaths = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const chromePath of possiblePaths) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(chromePath)) {
        return {
          executablePath: chromePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
          headless: true,
        };
      }
    } catch {
      // Continue to next path
    }
  }

  // Last resort: try puppeteer's bundled browser
  try {
    const puppeteerFull = await import('puppeteer');
    const execPath = puppeteerFull.executablePath();
    if (execPath) {
      return {
        executablePath: execPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        headless: true,
      };
    }
  } catch {
    // Puppeteer full not installed
  }

  throw new Error('No Chrome/Chromium browser found. Install Chrome or @sparticuz/chromium for serverless.');
}

/**
 * Fetch rendered HTML using Puppeteer (for JS-heavy sites)
 * Reuses existing browser instance if provided, otherwise creates a new one
 *
 * Works in both local development and serverless environments (Vercel/Lambda)
 * by using @sparticuz/chromium when running serverless.
 */
export async function fetchRenderedHtml(
  url: string,
  browser?: Browser
): Promise<string> {
  const shouldCloseBrowser = !browser;
  let page: Page | null = null;
  let browserInstance = browser;

  try {
    // Use provided browser or create new one
    if (!browserInstance) {
      try {
        const config = await getBrowserConfig();

        browserInstance = await puppeteer.launch({
          executablePath: config.executablePath,
          headless: config.headless,
          args: config.args,
        });
      } catch (launchError) {
        const errorMsg = launchError instanceof Error ? launchError.message : 'Unknown error';
        console.error(`[html-fetch] Failed to launch browser for ${url}:`, errorMsg);
        throw new Error(`Failed to launch browser: ${errorMsg}`);
      }
    }

    page = await browserInstance.newPage();

    // Set realistic browser headers to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate and wait for content
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Give JS time to populate dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait for content to be visible (heuristic: check for substantial text)
    await page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        return text.length > 500; // Wait until we have substantial content
      },
      { timeout: 10000 }
    ).catch(() => {
      // If timeout, continue anyway - some pages might not have much text
      console.log('[html-fetch] Content wait timeout, proceeding anyway');
    });

    // Get fully rendered HTML
    const html = await page.content();

    return html;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[html-fetch] Error fetching rendered HTML for ${url}:`, errorMsg);

    // Provide more specific error messages
    if (errorMsg.includes('timeout') || errorMsg.includes('TimeoutError')) {
      throw new Error(`Page load timeout for ${url} - site may be slow or unresponsive`);
    } else if (errorMsg.includes('ERR_NAME_NOT_RESOLVED') || errorMsg.includes('net::')) {
      throw new Error(`Cannot resolve domain for ${url} - site may be down`);
    } else if (errorMsg.includes('Failed to launch browser')) {
      throw new Error(`Browser launch failed - ${errorMsg}`);
    }

    throw new Error(`Failed to fetch rendered HTML: ${errorMsg}`);
  } finally {
    // Ensure cleanup happens even if errors occur
    if (page) {
      await page.close().catch((e) => {
        console.warn('[html-fetch] Failed to close page:', e instanceof Error ? e.message : 'Unknown error');
      });
    }
    if (shouldCloseBrowser && browserInstance) {
      await browserInstance.close().catch((e) => {
        console.warn('[html-fetch] Failed to close browser:', e instanceof Error ? e.message : 'Unknown error');
      });
    }
  }
}

/**
 * Fetch HTML with JS fallback: tries static fetch first, falls back to rendered HTML if content appears empty
 */
export async function fetchHtmlWithJsFallback(url: string): Promise<string> {
  let html = '';

  // Try static fetch first with realistic headers
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      html = await response.text();
    } else {
      console.warn(`[html-fallback] HTTP ${response.status} for ${url}, trying rendered HTML`);
      return fetchRenderedHtml(url);
    }
  } catch (e) {
    console.warn(`[html-fallback] Primary fetch failed for ${url}, using rendered HTML:`, e instanceof Error ? e.message : 'Unknown error');

    // Try rendered HTML as fallback
    try {
      return await fetchRenderedHtml(url);
    } catch (renderError) {
      // Both methods failed - throw a clear error
      const originalError = e instanceof Error ? e.message : String(e);
      const renderErrorMsg = renderError instanceof Error ? renderError.message : String(renderError);
      throw new Error(`Failed to fetch ${url}: ${originalError}. Puppeteer fallback also failed: ${renderErrorMsg}`);
    }
  }

  // Heuristic: if there is very little visible text, treat as empty and re-fetch rendered HTML
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  const tooShort = textOnly.length < 500; // Tune threshold as needed

  if (tooShort) {
    console.log(`[html-fallback] Static HTML appears empty (${textOnly.length} chars), using JS-rendered version: ${url}`);
    try {
      return await fetchRenderedHtml(url);
    } catch (e) {
      console.warn(`[html-fallback] Rendered fetch failed, falling back to static: ${url}`, e instanceof Error ? e.message : 'Unknown error');
      return html; // Return static HTML as fallback
    }
  }

  return html;
}
