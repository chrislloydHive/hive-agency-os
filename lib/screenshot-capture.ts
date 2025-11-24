import * as puppeteer from 'puppeteer';
import {
  detectWithBrowser,
  BlogAnalysis,
  AnalyticsAnalysis,
  BrandAuthority,
} from './extraction-utils';

export interface ScreenshotData {
  aboveFold: string; // base64 encoded image
  midPage: string; // base64 encoded image
}

export interface DetectionData {
  blogAnalysis: BlogAnalysis | null;
  analyticsAnalysis: AnalyticsAnalysis | null;
  brandAuthority: BrandAuthority | null;
}

/**
 * Capture screenshots and perform detection (blog, analytics, brand authority)
 * @param url - Website URL to capture
 * @returns Promise resolving to screenshot data and detection data
 */
export async function captureScreenshots(
  url: string
): Promise<ScreenshotData | null> {
  return (await captureScreenshotsWithDetection(url))?.screenshots || null;
}

/**
 * Capture screenshots and perform detection (blog, analytics, brand authority)
 * @param url - Website URL to capture
 * @returns Promise resolving to screenshot data and detection data
 */
export async function captureScreenshotsWithDetection(
  url: string
): Promise<{ screenshots: ScreenshotData; detection: DetectionData } | null> {
  let browser: puppeteer.Browser | null = null;
  
  try {
    console.log('🚀 Launching Puppeteer browser for screenshot capture...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });
    console.log('✅ Browser launched successfully');

    const page = await browser.newPage();
    
    // Set viewport size - 1080px height for above-fold capture
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    console.log(`📸 Navigating to ${url} for screenshot capture...`);
    
    // Navigate to page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait a bit for any animations/loading to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Capture Screenshot A: Above-the-fold (exactly 1080px height)
    console.log('📸 Capturing Screenshot A (above-fold, 1080px height)...');
    const aboveFoldScreenshot = await page.screenshot({
      encoding: 'base64',
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080, // Exactly 1080px height
      },
    }) as string;

    // Get page height to calculate 50-60% scroll position
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const scrollPosition = Math.floor(pageHeight * 0.55); // 55% (middle of 50-60% range)

    // Scroll to 50-60% of page height and capture Screenshot B
    console.log(`📸 Scrolling to ${scrollPosition}px (${Math.round((scrollPosition / pageHeight) * 100)}% of page) for Screenshot B...`);
    await page.evaluate((scrollPos) => {
      window.scrollTo(0, scrollPos);
    }, scrollPosition);
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for scroll to complete

    const midPageScreenshot = await page.screenshot({
      encoding: 'base64',
      type: 'png',
      clip: {
        x: 0,
        y: scrollPosition,
        width: 1920,
        height: 1080, // Capture 1080px height from scroll position
      },
    }) as string;

    console.log(`✅ Screenshots captured successfully (aboveFold: ${aboveFoldScreenshot.length} chars, midPage: ${midPageScreenshot.length} chars)`);

    const screenshots = {
      aboveFold: `data:image/png;base64,${aboveFoldScreenshot}`,
      midPage: `data:image/png;base64,${midPageScreenshot}`,
    };

    // Perform detection (blog, analytics, brand authority)
    console.log('🔍 Performing detection (blog, analytics, brand authority)...');
    let detection: DetectionData;
    try {
      detection = await detectWithBrowser(url, browser);
      console.log('✅ Detection completed:');
      console.log(`   - Blog Analysis: ${detection.blogAnalysis ? `✅ ${detection.blogAnalysis.postCount} posts` : '❌'}`);
      console.log(`   - Analytics: ${detection.analyticsAnalysis ? '✅' : '❌'}`);
      if (detection.analyticsAnalysis) {
        console.log(`     GA4: ${detection.analyticsAnalysis.ga4Detected ? '✅' : '❌'}`);
        console.log(`     GTM: ${detection.analyticsAnalysis.gtmDetected ? '✅' : '❌'}`);
        console.log(`     Meta Pixel: ${detection.analyticsAnalysis.metaPixelDetected ? '✅' : '❌'}`);
      }
      console.log(`   - Brand Authority: ${detection.brandAuthority ? '✅' : '❌'}`);
      if (detection.brandAuthority) {
        console.log(`     LinkedIn: ${detection.brandAuthority.linkedin?.url ? '✅' : '❌'}`);
        console.log(`     GBP: ${detection.brandAuthority.gbp?.url ? '✅' : '❌'}`);
      }
    } catch (detectionError) {
      console.error('❌ Error during detection:', detectionError);
      // CRITICAL: Detection is required - fail fast
      throw new Error(`Failed to perform detection: ${detectionError instanceof Error ? detectionError.message : 'Unknown error'}`);
    }

    return {
      screenshots,
      detection,
    };
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    // CRITICAL: Screenshots and detection are required - fail fast
    throw new Error(`Failed to capture screenshots and perform detection: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

