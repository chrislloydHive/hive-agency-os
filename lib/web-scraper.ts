import * as puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export interface WebsiteAnalysis {
  url: string;
  title: string;
  description: string;
  content: string;
  images: string[];
  metaTags: Record<string, string>;
  loadTime: number;
  mobileFriendly: boolean;
  seoScore: number;
  brandElements: {
    logo: boolean;
    tagline: boolean;
    contactInfo: boolean;
    socialLinks: boolean;
  };
  contentQuality: {
    wordCount: number;
    hasBlog: boolean;
    hasTestimonials: boolean;
    hasCaseStudies: boolean;
    callToActions: string[];
  };
  technicalIssues: string[];
}

export class WebScraper {
  private browser: puppeteer.Browser | null = null;

  async initialize() {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
          ]
        });
        console.log('✅ Puppeteer browser initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Puppeteer browser:', error);
        throw new Error(`Browser initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
    try {
      await this.initialize();
      
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      const page = await this.browser.newPage();
      const startTime = Date.now();

      try {
        // Set user agent to avoid being blocked
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        console.log(`🌐 Navigating to: ${url}`);
        // Navigate to the page with more lenient timeout
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        
        const loadTime = Date.now() - startTime;
        console.log(`⏱️ Page loaded in ${loadTime}ms`);

        // Get page content
        const content = await page.content();
        const $ = cheerio.load(content);

        // Extract basic information
        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') || '';
        
        // Extract all text content
        const textContent = $('body').text().replace(/\s+/g, ' ').trim();
        
        // Extract images
        const images = $('img').map((_, el) => $(el).attr('src')).get().filter(Boolean) as string[];
        
        // Extract meta tags
        const metaTags: Record<string, string> = {};
        $('meta').each((_, el) => {
          const name = $(el).attr('name') || $(el).attr('property');
          const content = $(el).attr('content');
          if (name && content) {
            metaTags[name] = content;
          }
        });

        // Check mobile friendliness
        const mobileFriendly = await this.checkMobileFriendly(page);
        
        // Calculate SEO score
        const seoScore = this.calculateSEOScore($, metaTags);
        
        // Analyze brand elements
        const brandElements = this.analyzeBrandElements($);
        
        // Analyze content quality
        const contentQuality = this.analyzeContentQuality($, textContent);
        
        // Check for technical issues
        const technicalIssues = this.checkTechnicalIssues($, page);

        return {
          url,
          title,
          description,
          content: textContent,
          images,
          metaTags,
          loadTime,
          mobileFriendly,
          seoScore,
          brandElements,
          contentQuality,
          technicalIssues
        };

      } finally {
        await page.close();
      }
    } catch (error) {
      console.error('❌ Website analysis failed:', error);
      throw error;
    }
  }

  private async checkMobileFriendly(page: puppeteer.Page): Promise<boolean> {
    try {
      await page.setViewport({ width: 375, height: 667 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if content is readable on mobile
      const mobileContent = await page.evaluate(() => {
        const body = document.body;
        const fontSize = window.getComputedStyle(body).fontSize;
        const width = body.scrollWidth;
        return {
          fontSize: parseFloat(fontSize),
          width,
          isMobileFriendly: width <= 375 && parseFloat(fontSize) >= 14
        };
      });
      
      return mobileContent.isMobileFriendly;
    } catch (error) {
      console.error('Error checking mobile friendliness:', error);
      return false;
    }
  }

  private calculateSEOScore($: cheerio.CheerioAPI, metaTags: Record<string, string>): number {
    let score = 0;
    
    // Title presence and length
    const title = $('title').text();
    if (title) {
      score += 10;
      if (title.length >= 30 && title.length <= 60) score += 10;
    }
    
    // Meta description
    if (metaTags.description) {
      score += 10;
      if (metaTags.description.length >= 120 && metaTags.description.length <= 160) score += 10;
    }
    
    // Headings structure
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    if (h1Count === 1) score += 10;
    if (h2Count > 0) score += 5;
    
    // Images with alt text
    const imagesWithAlt = $('img[alt]').length;
    const totalImages = $('img').length;
    if (totalImages > 0) {
      const altRatio = imagesWithAlt / totalImages;
      score += Math.round(altRatio * 10);
    }
    
    // Internal links
    const internalLinks = $('a[href^="/"]').length;
    if (internalLinks > 0) score += 5;
    
    return Math.min(100, score);
  }

  private analyzeBrandElements($: cheerio.CheerioAPI) {
    return {
      logo: $('img[alt*="logo"], img[alt*="Logo"], .logo, #logo').length > 0,
      tagline: $('h1, h2, .tagline, .slogan').text().length > 0,
      contactInfo: $('a[href^="tel:"], a[href^="mailto:"], .contact, #contact').length > 0,
      socialLinks: $('a[href*="facebook"], a[href*="twitter"], a[href*="linkedin"], a[href*="instagram"]').length > 0
    };
  }

  private analyzeContentQuality($: cheerio.CheerioAPI, textContent: string) {
    const wordCount = textContent.split(' ').length;
    
    return {
      wordCount,
      hasBlog: $('a[href*="blog"], a[href*="news"], .blog, #blog').length > 0,
      hasTestimonials: $('.testimonial, .review, [class*="testimonial"], [id*="testimonial"]').length > 0,
      hasCaseStudies: $('.case-study, .case-study, [class*="case"], [id*="case"]').length > 0,
      callToActions: $('a[href*="contact"], a[href*="quote"], a[href*="demo"], .cta, .button').map((_, el) => $(el).text().trim()).get()
    };
  }

  private checkTechnicalIssues($: cheerio.CheerioAPI, _page: puppeteer.Page): string[] {
    const issues: string[] = [];
    
    // Check for broken images
    const images = $('img');
    images.each((_, img) => {
      const src = $(img).attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('//')) {
        issues.push(`Relative image path: ${src}`);
      }
    });
    
    // Check for missing alt text
    const imagesWithoutAlt = $('img:not([alt])').length;
    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} images missing alt text`);
    }
    
    // Check for broken links (basic check)
    const links = $('a[href]');
    links.each((_, link) => {
      const href = $(link).attr('href');
      if (href && href.startsWith('#') && !$(href).length) {
        issues.push(`Broken anchor link: ${href}`);
      }
    });
    
    return issues;
  }
}

