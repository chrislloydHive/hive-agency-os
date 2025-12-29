import * as puppeteer from 'puppeteer';

// Blog detection keywords
const BLOG_KEYWORDS = [
  'blog',
  'insights',
  'news',
  'resources',
  'articles',
  'stories',
  'learn',
  'updates',
  'journal',
  'posts',
];

export interface RawBlogPost {
  title: string;
  url: string;
  publishedAt?: string;
}

export interface BlogAnalysis {
  postCount: number;
  latestPostDate?: string;
  postingFrequency?: 'no_recent_posts' | 'low' | 'medium' | 'high';
  topics?: string[];
  hasInternalLinksToCorePages?: boolean;
  notes?: string;
}

export interface AnalyticsAnalysis {
  ga4Detected: boolean;
  gtmDetected: boolean;
  metaPixelDetected: boolean;
  hotjarDetected: boolean;
  mixpanelOrAmplitudeDetected: boolean;
  summary?: string;
}

export interface BrandAuthority {
  linkedin?: {
    url: string | null;
    followers: number | null;
    postingFrequency: string | null;
    latestPostDate: string | null;
    summary?: string;
    analysis?: any; // Full LinkedIn analysis with insights and recommendations
  };
  gbp?: {
    url: string | null;
    reviewCount: number | null;
    rating: number | null;
    latestReviewDate: string | null;
    summary?: string;
    analysis?: any; // Full Google Business Profile analysis with insights and recommendations
  };
}

/**
 * Detect blog URL from navigation/footer links using Puppeteer page
 */
export async function detectBlogUrl(page: puppeteer.Page, baseUrl: string): Promise<string | null> {
  // Deep debug logging for TrainrHub
  const isTrainrHub = baseUrl.includes('trainrhub.com');
  
  const blogUrl = await page.evaluate((baseUrl, keywords, isTrainrHub) => {
    const anchors = Array.from(document.querySelectorAll('a'));
    
    // Deep debug logging for TrainrHub
    if (isTrainrHub) {
      console.log('[blog-debug] TrainrHub anchors:', anchors.map(a => ({
        text: a.textContent?.trim(),
        href: a.getAttribute('href')
      })).filter(a => a.href && (a.href.includes('blog') || a.text?.toLowerCase().includes('blog'))));
    }
    
    // Strengthened detection logic - very forgiving
    for (const a of anchors) {
      const text = (a.textContent || '').toLowerCase();
      const hrefAttr = a.getAttribute('href') || '';
      const hrefLower = hrefAttr.toLowerCase();

      const matchesKeyword = keywords.some((k: string) =>
        text.includes(k) || 
        hrefLower === `/${k}` || 
        hrefLower.startsWith(`/${k}/`) ||
        hrefLower.includes(`/${k}`) ||
        hrefLower.endsWith(`/${k}`)
      );

      if (!matchesKeyword) continue;

      try {
        // Always resolve relative hrefs against baseUrl
        const resolved = new URL(hrefAttr, baseUrl).toString();
        if (isTrainrHub) {
          console.log(`[blog-debug] Found blog URL for TrainrHub: ${resolved} from text="${text}", href="${hrefAttr}"`);
        }
        return resolved;
      } catch {
        continue;
      }
    }

    return null;
  }, baseUrl, BLOG_KEYWORDS, isTrainrHub);
  
  if (isTrainrHub) {
    console.log(`[blog-debug] detected blog URL for ${baseUrl} => ${blogUrl || 'null'}`);
  }
  
  if (blogUrl) {
    console.log(`✅ Blog URL detected: ${blogUrl}`);
  } else {
    console.log(`⚠️  No blog URL detected from ${baseUrl}`);
  }

  return blogUrl;
}

/**
 * Detect LinkedIn Company Page URL from navigation/footer links using Puppeteer page
 */
export async function detectLinkedInUrl(page: puppeteer.Page, baseUrl: string): Promise<string | null> {
  const linkedInUrl = await page.evaluate((baseUrl) => {
    const anchors = Array.from(document.querySelectorAll('a'));
    
    // Debug: collect all LinkedIn links
    const linkedInLinks: string[] = [];

    for (const a of anchors) {
      const hrefAttr = a.getAttribute('href');
      if (!hrefAttr) continue;
      
      const href = hrefAttr.toLowerCase();

      if (!href.includes('linkedin.com')) continue;
      
      linkedInLinks.push(hrefAttr);
      
      if (!href.includes('/company/') && !href.includes('/school/')) continue;

      try {
        const url = new URL(hrefAttr, baseUrl).toString();
        console.log(`[debug] Found LinkedIn URL: ${url}`);
        return url;
      } catch {
        continue;
      }
    }
    
    if (linkedInLinks.length > 0) {
      console.log(`[debug] Found ${linkedInLinks.length} LinkedIn links but none matched /company/ or /school/:`, linkedInLinks.slice(0, 3));
    }

    return null;
  }, baseUrl);
  
  if (linkedInUrl) {
    console.log(`✅ LinkedIn URL detected: ${linkedInUrl}`);
  } else {
    console.log(`⚠️  No LinkedIn Company Page URL detected`);
  }

  return linkedInUrl;
}

/**
 * Detect Google Business Profile URL from navigation/footer links using Puppeteer page
 */
export async function detectGbpUrl(page: puppeteer.Page, baseUrl: string): Promise<string | null> {
  const gbpUrl = await page.evaluate((baseUrl) => {
    const anchors = Array.from(document.querySelectorAll('a'));
    
    // Debug: collect all Google Maps/Business links
    const gbpLinks: string[] = [];

    for (const a of anchors) {
      const hrefAttr = a.getAttribute('href');
      if (!hrefAttr) continue;
      
      const href = hrefAttr.toLowerCase();

      if (
        href.includes('goo.gl/maps') ||
        href.includes('maps.google.') ||
        href.includes('g.page/') ||
        href.includes('google.com/maps') ||
        href.includes('google.com/business')
      ) {
        gbpLinks.push(hrefAttr);
        try {
          const url = new URL(hrefAttr, baseUrl).toString();
          console.log(`[debug] Found GBP URL: ${url}`);
          return url;
        } catch {
          continue;
        }
      }
    }
    
    if (gbpLinks.length > 0) {
      console.log(`[debug] Found ${gbpLinks.length} Google Maps/Business links:`, gbpLinks.slice(0, 3));
    }

    return null;
  }, baseUrl);
  
  if (gbpUrl) {
    console.log(`✅ GBP URL detected: ${gbpUrl}`);
  } else {
    console.log(`⚠️  No Google Business Profile URL detected`);
  }

  return gbpUrl;
}

/**
 * Parse blog posts from a blog listing page using Puppeteer page
 * Returns posts array and estimated total count
 */
export async function parseBlogPosts(page: puppeteer.Page, baseUrl: string): Promise<{ posts: RawBlogPost[]; totalCount: number }> {
  const isTrainrHub = baseUrl.includes('trainrhub.com');
  
  // Debug: log page HTML for TrainrHub
  if (isTrainrHub) {
    const html = await page.content();
    console.log(`[blog-debug] TrainrHub blog page HTML length: ${html.length} chars`);
    console.log(`[blog-debug] First 2000 chars of HTML:`, html.slice(0, 2000));
    
    // Check visible text content
    const textContent = await page.evaluate(() => document.body.innerText || '');
    console.log(`[blog-debug] Visible text length: ${textContent.length} chars`);
    console.log(`[blog-debug] First 500 chars of visible text:`, textContent.slice(0, 500));
  }
  
  const evaluationResult = await page.evaluate((baseUrl, isTrainrHub) => {
    const posts: RawBlogPost[] = [];
    const seenUrls = new Set<string>();

    // Try <article> tags first (most common pattern)
    const articles = Array.from(document.querySelectorAll('article'));
    if (isTrainrHub) {
      console.log(`[blog-debug] Found ${articles.length} <article> elements`);
      
      // Debug: Log first article's structure
      if (articles.length > 0) {
        const firstArticle = articles[0];
        console.log(`[blog-debug] First article HTML (first 500 chars):`, firstArticle.innerHTML.substring(0, 500));
        console.log(`[blog-debug] First article text:`, firstArticle.textContent?.trim().substring(0, 200));
      }
    }
    
    if (articles.length > 0) {
      for (const art of articles) {
        // Try multiple strategies to find title and link
        let link: HTMLAnchorElement | null = art.querySelector('a[href]');
        let title = '';
        
        // Strategy 1: Link text
        if (link) {
          title = (link.textContent || '').trim();
        }
        
        // Strategy 2: Heading within article
        if (!title || title.length < 10) {
          const heading = art.querySelector('h1, h2, h3, h4, h5, h6');
          if (heading) {
            title = (heading.textContent || '').trim();
            // If heading has a link, use that
            const headingLink = heading.querySelector('a[href]');
            if (headingLink) {
              link = headingLink as HTMLAnchorElement;
            }
          }
        }
        
        // Strategy 3: First substantial text node
        if (!title || title.length < 10) {
          title = (art.textContent || '').trim().split('\n')[0].substring(0, 200);
        }
        
        const hrefAttr = link?.getAttribute('href') || '';
        
        if (!title || title.length < 5 || !hrefAttr || seenUrls.has(hrefAttr)) continue;

        let url: string;
        try {
          url = new URL(hrefAttr, baseUrl).toString();
        } catch {
          continue;
        }

        const timeEl = art.querySelector('time, [datetime], [class*="date"], [class*="time"]');
        const publishedAt = timeEl?.getAttribute('datetime') || 
                           timeEl?.getAttribute('date') ||
                           timeEl?.textContent?.trim() || 
                           undefined;

        posts.push({ title, url, publishedAt });
        seenUrls.add(hrefAttr);
      }
    }

    // Fallback: look for blog card containers (divs with blog-related classes)
    if (posts.length === 0) {
      if (isTrainrHub) {
        console.log('[blog-debug] No articles found, trying blog card extraction');
      }
      
      // Look for divs with blog-related classes that might contain posts
      const blogContainers = Array.from(document.querySelectorAll('[class*="blog"], [class*="post"], [class*="article"], [class*="card"]'));
      if (isTrainrHub) {
        console.log(`[blog-debug] Found ${blogContainers.length} potential blog containers`);
      }
      
      for (const container of blogContainers) {
        // Look for links and headings within container
        const link = container.querySelector('a[href]');
        const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
        
        if (!link) continue;
        
        const hrefAttr = link.getAttribute('href') || '';
        const title = heading ? (heading.textContent || '').trim() : (link.textContent || '').trim();
        const hrefLower = hrefAttr.toLowerCase();

        // Check if this looks like a blog post link
        const isBlogLink = hrefLower.includes('/blog/') || 
                          hrefLower.includes('/post/') || 
                          hrefLower.includes('/article/') ||
                          hrefLower.includes('/news/') ||
                          (title.length > 10 && title.length < 200 && !title.toLowerCase().includes('blog'));
        
        if (!isBlogLink || !title || title.length < 5) continue;
        if (seenUrls.has(hrefAttr)) continue;

        let url: string;
        try {
          url = new URL(hrefAttr, baseUrl).toString();
        } catch {
          continue;
        }

        // Try to find date nearby
        let publishedAt: string | undefined;
        const dateEl = container.querySelector('time, [datetime], .date, [class*="date"], [class*="time"], [class*="published"]');
        if (dateEl) {
          publishedAt =
            dateEl.getAttribute('datetime') ||
            dateEl.getAttribute('date') ||
            dateEl.textContent?.trim() ||
            undefined;
        }

        posts.push({ title, url, publishedAt });
        seenUrls.add(hrefAttr);
      }
      
      if (isTrainrHub) {
        console.log(`[blog-debug] Blog container extraction found ${posts.length} posts`);
      }
    }

    // Fallback: look for common blog card containers and links with /blog/ in path
    if (posts.length === 0) {
      if (isTrainrHub) {
        console.log('[blog-debug] No blog containers found, trying link-based extraction');
      }
      
      const links = Array.from(document.querySelectorAll('a[href]'));
      if (isTrainrHub) {
        console.log(`[blog-debug] Found ${links.length} total links`);
        
        // Debug: Log all blog-related links
        const blogRelatedLinks = links.filter(link => {
          const href = (link.getAttribute('href') || '').toLowerCase();
          return href.includes('/blog/') || href.includes('/post/') || href.includes('/article/');
        });
        console.log(`[blog-debug] Found ${blogRelatedLinks.length} blog-related links`);
        blogRelatedLinks.slice(0, 10).forEach((link, idx) => {
          console.log(`[blog-debug] Link ${idx + 1}:`, {
            href: link.getAttribute('href'),
            text: link.textContent?.trim().substring(0, 50),
            parent: link.parentElement?.tagName,
            parentClass: link.parentElement?.className
          });
        });
      }
      
      for (const link of links) {
        const hrefAttr = link.getAttribute('href') || '';
        let title = (link.textContent || '').trim();
        const hrefLower = hrefAttr.toLowerCase();

        // Heuristic: blog links often contain /blog/ in the path
        // Also check for post/article patterns - be more lenient
        const isBlogLink = hrefLower.includes('/blog/') || 
                          hrefLower.includes('/post/') || 
                          hrefLower.includes('/article/') ||
                          hrefLower.includes('/news/') ||
                          hrefLower.match(/\/blog\/[^/]+$/); // Blog post URL pattern
        
        if (!isBlogLink) continue;
        
        // If link text is too short, try to find nearby heading
        if (!title || title.length < 5) {
          // Look for heading in parent or nearby
          const parent = link.parentElement;
          if (parent) {
            const heading = parent.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
              title = (heading.textContent || '').trim();
            }
          }
          
          // If still no title, try next sibling
          if (!title || title.length < 5) {
            let current: Element | null = link.nextElementSibling;
            let attempts = 0;
            while (current && attempts < 2) {
              const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
              if (heading) {
                title = (heading.textContent || '').trim();
                break;
              }
              current = current.nextElementSibling;
              attempts++;
            }
          }
        }
        
        if (!title || title.length < 5) continue;
        if (seenUrls.has(hrefAttr)) continue;

        let url: string;
        try {
          url = new URL(hrefAttr, baseUrl).toString();
        } catch {
          continue;
        }

        // Try to find date nearby
        let publishedAt: string | undefined;
        const parent = link.parentElement || link.closest('div, li, article');
        if (parent) {
          const dateEl = parent.querySelector('time, [datetime], .date, [class*="date"], [class*="time"], [class*="published"]');
          if (dateEl) {
            publishedAt =
              dateEl.getAttribute('datetime') ||
              dateEl.getAttribute('date') ||
              dateEl.textContent?.trim() ||
              undefined;
          }
        }

        posts.push({ title, url, publishedAt });
        seenUrls.add(hrefAttr);
      }
      
      if (isTrainrHub) {
        console.log(`[blog-debug] Link-based extraction found ${posts.length} posts`);
      }
    }

    // Additional fallback: look for headings with links (common blog listing pattern)
    if (posts.length === 0) {
      if (isTrainrHub) {
        console.log('[blog-debug] Trying heading-based extraction');
      }
      
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5'));
      for (const heading of headings) {
        const headingText = (heading.textContent || '').trim();
        if (headingText.length < 15 || headingText.length > 200) continue;
        
        // Skip if heading is "Blog" or similar
        if (headingText.toLowerCase() === 'blog' || headingText.toLowerCase().includes('blog archive')) continue;
        
        // Look for a link within or near this heading
        let link: HTMLAnchorElement | null = heading.querySelector('a[href]') as HTMLAnchorElement;
        
        // If no link in heading, check next sibling or parent
        if (!link) {
          const parentLink = heading.closest('a[href]');
          if (parentLink) {
            link = parentLink as HTMLAnchorElement;
          } else {
            let current: Element | null = heading.nextElementSibling;
            let attempts = 0;
            while (current && attempts < 3) {
              link = current.querySelector('a[href]') as HTMLAnchorElement;
              if (link) break;
              current = current.nextElementSibling;
              attempts++;
            }
          }
        }
        
        if (link) {
          const hrefAttr = link.getAttribute('href');
          if (hrefAttr && !seenUrls.has(hrefAttr)) {
            try {
              const url = new URL(hrefAttr, baseUrl).toString();
              // Include if URL looks like a blog post OR if heading looks like a post title
              const looksLikePost = url.includes('/blog/') || 
                                   url.includes('/post/') || 
                                   url.includes('/article/') ||
                                   url.includes('/news/') ||
                                   (headingText.length > 20 && headingText.length < 150 && !headingText.toLowerCase().includes('blog'));
              
              if (looksLikePost) {
                // Try to find date nearby
                let publishedAt: string | undefined;
                const container = heading.parentElement || heading.closest('div, li, article');
                if (container) {
                  const dateEl = container.querySelector('time, .date, [class*="date"], [class*="time"], [class*="published"]');
                  if (dateEl) {
                    publishedAt =
                      dateEl.getAttribute('datetime') ||
                      dateEl.getAttribute('date') ||
                      dateEl.textContent?.trim() ||
                      undefined;
                  }
                }
                
                posts.push({ title: headingText, url, publishedAt });
                seenUrls.add(hrefAttr);
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }
      
      if (isTrainrHub) {
        console.log(`[blog-debug] Heading-based extraction found ${posts.length} posts`);
      }
    }
    
    // Last resort: Very aggressive extraction - any link with substantial text that might be a post
    if (posts.length === 0) {
      if (isTrainrHub) {
        console.log('[blog-debug] Last resort: Aggressive link extraction');
      }
      
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      if (isTrainrHub) {
        console.log(`[blog-debug] Total links to check: ${allLinks.length}`);
      }
      
      for (const link of allLinks) {
        const hrefAttr = link.getAttribute('href') || '';
        const hrefLower = hrefAttr.toLowerCase();
        let linkText = (link.textContent || '').trim();
        
        // Skip if already seen
        if (seenUrls.has(hrefAttr)) continue;
        
        // Check if URL is on the same domain and might be a blog post
        try {
          const linkUrl = new URL(hrefAttr, baseUrl);
          const baseUrlObj = new URL(baseUrl);
          
          // Must be same domain
          if (linkUrl.hostname !== baseUrlObj.hostname) continue;
          
          // Check if path looks like a blog post (has multiple segments, not just /blog)
          const pathSegments = linkUrl.pathname.split('/').filter(s => s.length > 0);
          
          // If it's a blog URL with a post slug (e.g., /blog/post-title)
          const isBlogPostUrl = hrefLower.includes('/blog/') && pathSegments.length >= 2;
          
          if (isBlogPostUrl) {
            // Try to find a better title from nearby elements
            const parent = link.parentElement || link.closest('div, li, article, section');
            if (parent) {
              // Look for heading in parent
              const heading = parent.querySelector('h1, h2, h3, h4, h5, h6');
              if (heading && heading.textContent) {
                const headingText = heading.textContent.trim();
                if (headingText.length > linkText.length && headingText.length > 10) {
                  linkText = headingText;
                }
              }
              
              // Also check for title in data attributes or aria-label
              const titleAttr = parent.getAttribute('title') || parent.getAttribute('aria-label');
              if (titleAttr && titleAttr.length > linkText.length && titleAttr.length > 10) {
                linkText = titleAttr;
              }
            }
            
            // Accept links with text length 5-300 (more lenient)
            if (linkText.length >= 5 && linkText.length <= 300 && !linkText.toLowerCase().includes('read more') && !linkText.toLowerCase().includes('continue reading')) {
              let url: string;
              try {
                url = new URL(hrefAttr, baseUrl).toString();
              } catch {
                continue;
              }
              
              // Try to find date nearby
              let publishedAt: string | undefined;
              const container = link.parentElement || link.closest('div, li, article, section');
              if (container) {
                const dateEl = container.querySelector('time, [datetime], .date, [class*="date"], [class*="time"], [class*="published"]');
                if (dateEl) {
                  publishedAt =
                    dateEl.getAttribute('datetime') ||
                    dateEl.getAttribute('date') ||
                    dateEl.textContent?.trim() ||
                    undefined;
                }
              }
              
              posts.push({ title: linkText, url, publishedAt });
              seenUrls.add(hrefAttr);
            }
          }
        } catch {
          continue;
        }
      }
      
      if (isTrainrHub) {
        console.log(`[blog-debug] Aggressive extraction found ${posts.length} posts`);
        if (posts.length > 0) {
          console.log(`[blog-debug] Sample posts from aggressive extraction:`, posts.slice(0, 3).map(p => ({ title: p.title.substring(0, 50), url: p.url })));
        }
      }
    }

    // Try to get actual total count if possible (for pagination, check for "showing X of Y" text)
    let totalCount = posts.length;
    try {
      const countText = document.body.innerText || '';
      const countMatch = countText.match(/(\d+)\s*(?:of|out of|total)\s*(\d+)/i) || 
                        countText.match(/showing\s*(\d+)[\s-]+(\d+)/i) ||
                        countText.match(/(\d+)\s*posts?/i);
      if (countMatch && countMatch[2]) {
        const parsedTotal = parseInt(countMatch[2], 10);
        if (!isNaN(parsedTotal) && parsedTotal > posts.length) {
          totalCount = parsedTotal;
        }
      }
    } catch {
      // Ignore errors in count detection
    }

    if (isTrainrHub) {
      console.log(`[blog-debug] posts found: ${posts.length}`);
      console.log(`[blog-debug] estimated total count: ${totalCount}`);
      console.log(`[blog-debug] sample titles:`, posts.slice(0, 5).map(p => p.title));
      console.log(`[blog-debug] sample URLs:`, posts.slice(0, 5).map(p => p.url));
    }

    // Return first 10 posts for detailed analysis, but include total count estimate
    // Return ALL posts found (no limit)
    return { posts, totalCount };
  }, baseUrl, isTrainrHub);
  
  return evaluationResult;
}

/**
 * Analyze blog posts and derive blog analysis
 */
export function analyzeBlogPosts(
  posts: RawBlogPost[],
  _baseUrl: string
): BlogAnalysis | null {
  if (posts.length === 0) {
    console.log(`⚠️  Blog posts array is empty - returning null (not 0 posts)`);
    return null; // Return null if no posts found, not an object with postCount: 0
  }

  // Parse dates and find latest
  const parsedDates: Array<{ post: RawBlogPost; date: Date }> = [];
  posts.forEach((post) => {
    if (post.publishedAt) {
      const date = new Date(post.publishedAt);
      if (!isNaN(date.getTime())) {
        parsedDates.push({ post, date });
      }
    }
  });

  parsedDates.sort((a, b) => b.date.getTime() - a.date.getTime());
  const latestPost = parsedDates[0];

  // Calculate posting frequency
  let postingFrequency: 'no_recent_posts' | 'low' | 'medium' | 'high' =
    'no_recent_posts';

  if (latestPost) {
    const monthsAgo =
      (Date.now() - latestPost.date.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsAgo > 12) {
      postingFrequency = 'no_recent_posts';
    } else if (monthsAgo > 3) {
      postingFrequency = 'low';
    } else if (monthsAgo > 1) {
      postingFrequency = 'medium';
    } else {
      postingFrequency = 'high';
    }
  }

  // Extract topics from titles
  const topicWords = new Map<string, number>();
  posts.forEach((post) => {
    const words = post.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4); // Filter short words

    words.forEach((word) => {
      topicWords.set(word, (topicWords.get(word) || 0) + 1);
    });
  });

  const topics = Array.from(topicWords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Check for internal links to core pages
  const corePagePatterns = [
    '/services',
    '/solutions',
    '/pricing',
    '/products',
    '/about',
    '/contact',
  ];

  const hasInternalLinksToCorePages = posts.some((post) =>
    corePagePatterns.some((pattern) => post.url.includes(pattern))
  );

  return {
    postCount: posts.length,
    latestPostDate: latestPost?.date.toISOString().split('T')[0],
    postingFrequency,
    topics: topics.length > 0 ? topics : undefined,
    hasInternalLinksToCorePages,
  };
}


/**
 * Detect analytics scripts from page
 */
export function detectAnalytics(scripts: Array<{ src: string | null; inline: string | null }>): AnalyticsAnalysis {
  function hasGA4(scripts: Array<{ src: string | null; inline: string | null }>): boolean {
    const found = scripts.some(
      (s) =>
        (s.src && (s.src.includes('googletagmanager.com/gtag/js') || s.src.includes('google-analytics.com'))) ||
        (s.inline && (s.inline.includes("gtag('config'") || s.inline.includes('gtag("config"') || s.inline.includes('GA_MEASUREMENT_ID')))
    );
    if (found) {
      console.log(`[debug] GA4 detected in scripts`);
    }
    return found;
  }

  function hasGTM(scripts: Array<{ src: string | null; inline: string | null }>): boolean {
    const found = scripts.some(
      (s) => s.src && s.src.includes('googletagmanager.com/gtm.js')
    );
    if (found) {
      console.log(`[debug] GTM detected in scripts`);
    }
    return found;
  }

  function hasMetaPixel(scripts: Array<{ src: string | null; inline: string | null }>): boolean {
    const found = scripts.some(
      (s) =>
        (s.src && s.src.includes('connect.facebook.net')) ||
        (s.inline && (s.inline.includes("fbq('init'") || s.inline.includes('fbq("init"') || s.inline.includes('_fbq')))
    );
    if (found) {
      console.log(`[debug] Meta Pixel detected in scripts`);
    }
    return found;
  }

  function hasHotjar(scripts: Array<{ src: string | null; inline: string | null }>): boolean {
    return scripts.some(
      (s) =>
        (s.src && s.src.includes('static.hotjar.com')) ||
        (s.inline && s.inline.toLowerCase().includes('hotjar('))
    );
  }

  function hasMixpanelOrAmplitude(scripts: Array<{ src: string | null; inline: string | null }>): boolean {
    return scripts.some((s) => {
      const src = s.src || '';
      const inline = s.inline || '';
      return (
        src.includes('mixpanel') ||
        src.includes('amplitude') ||
        inline.toLowerCase().includes('mixpanel.init') ||
        inline.toLowerCase().includes('amplitude.getinstance')
      );
    });
  }

  return {
    ga4Detected: hasGA4(scripts),
    gtmDetected: hasGTM(scripts),
    metaPixelDetected: hasMetaPixel(scripts),
    hotjarDetected: hasHotjar(scripts),
    mixpanelOrAmplitudeDetected: hasMixpanelOrAmplitude(scripts),
  };
}

/**
 * Extract scripts from page using Puppeteer
 */
export async function extractScriptsFromPage(
  page: puppeteer.Page
): Promise<Array<{ src: string | null; inline: string | null }>> {
  try {
    const scripts = await page.evaluate(() => {
      return Array.from(document.scripts).map((s) => ({
        src: s.src || null,
        inline: s.src ? null : s.textContent || '',
      }));
    });
    return scripts;
  } catch (error) {
    console.error('Error extracting scripts:', error);
    return [];
  }
}

/**
 * Detect blog, analytics, and brand authority using headless browser
 */
export async function detectWithBrowser(
  url: string,
  browser: puppeteer.Browser
): Promise<{
  blogAnalysis: BlogAnalysis | null;
  analyticsAnalysis: AnalyticsAnalysis | null;
  brandAuthority: BrandAuthority | null;
}> {
  const page = await browser.newPage();
  let blogAnalysis: BlogAnalysis | null = null;
  let analyticsAnalysis: AnalyticsAnalysis | null = null;
  let brandAuthority: BrandAuthority | null = null;

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    // Navigate to main page
    console.log(`🌐 Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Debug: Log page title and URL to confirm we're on the right page
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`📄 Page loaded: ${pageTitle} at ${pageUrl}`);
    
    // Debug: Count all links on the page
    const linkCount = await page.evaluate(() => document.querySelectorAll('a').length);
    console.log(`🔗 Found ${linkCount} links on page`);

    // Extract scripts for analytics detection
    const scripts = await extractScriptsFromPage(page);
    console.log(`📊 Extracted ${scripts.length} scripts for analytics detection`);
    analyticsAnalysis = detectAnalytics(scripts);
    console.log(`📊 Analytics detection results:`, {
      ga4: analyticsAnalysis.ga4Detected,
      gtm: analyticsAnalysis.gtmDetected,
      metaPixel: analyticsAnalysis.metaPixelDetected,
      hotjar: analyticsAnalysis.hotjarDetected,
      mixpanel: analyticsAnalysis.mixpanelOrAmplitudeDetected,
    });

    // Detect blog URL - try multiple strategies
    let blogUrl = await detectBlogUrl(page, url);
    console.log(`🔍 Initial blog URL detection: ${blogUrl || 'not found'}`);
    
    // Generic fallback: try common blog paths even if no link is found
    if (!blogUrl || blogUrl === url) {
      console.log('🔍 Trying fallback blog paths (generic check)...');
      const candidates = ['/blog', '/insights', '/news', '/resources', '/articles', '/posts'];
      
      // Save current URL to navigate back if needed
      const currentUrl = page.url();
      
      for (const path of candidates) {
        try {
          const candidateUrl = new URL(path, url).toString();
          console.log(`  Testing fallback: ${candidateUrl}`);
          
          const response = await page.goto(candidateUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000, // Increased timeout
          });
          
          if (response && response.ok()) {
            // Wait longer for JS-rendered content
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Scroll to trigger lazy loading
            await page.evaluate(async () => {
              await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                  const scrollHeight = document.body.scrollHeight;
                  window.scrollBy(0, distance);
                  totalHeight += distance;
                  if (totalHeight >= scrollHeight || totalHeight > 3000) {
                    clearInterval(timer);
                    resolve();
                  }
                }, 200);
              });
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if this looks like a blog page
            const hasPosts = await page.evaluate(() => {
              const articleCount = document.querySelectorAll('article').length;
              const blogLinkCount = document.querySelectorAll('a[href*="/blog/"], a[href*="/post/"], a[href*="/article/"]').length;
              const longHeadingCount = Array.from(document.querySelectorAll('h1, h2, h3, h4')).filter(
                (h) => (h.textContent || '').trim().length > 20
              ).length;
              
              return articleCount > 0 || blogLinkCount > 2 || longHeadingCount > 2;
            });
            
            if (hasPosts) {
              blogUrl = candidateUrl;
              console.log(`[blog-debug] fallback blog URL found: ${blogUrl}`);
              break;
            } else {
              // Navigate back to main page before trying next path
              await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
            }
          }
        } catch (error) {
          console.log(`  ⚠️  Error testing ${path}:`, error instanceof Error ? error.message : 'Unknown error');
          // Try to navigate back to main page
          try {
            await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
          } catch {
            break;
          }
          continue;
        }
      }
    }
    
    // Parse blog posts if blog URL was found
    if (blogUrl && blogUrl !== url) {
      try {
        console.log(`📝 Navigating to blog page: ${blogUrl}`);
        await page.goto(blogUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000, // Increased timeout for JS-heavy sites
        });
        
        const isTrainrHub = blogUrl.includes('trainrhub.com');
        
        // Scroll page to trigger lazy loading and ensure all content is rendered
        if (isTrainrHub) {
          console.log('[blog-debug] Scrolling page to trigger lazy loading...');
        }
        
        // Scroll down gradually to trigger any lazy-loaded content
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 200);
          });
        });
        
        // Wait for content to settle after scrolling
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Scroll back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Wait longer for JS-rendered content and ensure posts are visible
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time
        
        if (isTrainrHub) {
          console.log('[blog-debug] Waiting for TrainrHub blog content to render...');
          
          // Debug: Check what's actually on the page
          const pageInfo = await page.evaluate(() => {
            const articleCount = document.querySelectorAll('article').length;
            const blogLinks = Array.from(document.querySelectorAll('a[href*="/blog/"]')).map(a => ({
              href: a.getAttribute('href'),
              text: a.textContent?.trim().substring(0, 50)
            }));
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
              text: h.textContent?.trim().substring(0, 50),
              tag: h.tagName
            }));
            const textLength = (document.body.innerText || '').length;
            const allLinks = Array.from(document.querySelectorAll('a[href]')).length;
            
            return {
              articleCount,
              blogLinkCount: blogLinks.length,
              blogLinks: blogLinks.slice(0, 10),
              headingCount: headings.length,
              headings: headings.slice(0, 10),
              textLength,
              allLinks
            };
          });
          
          console.log('[blog-debug] Page analysis:', JSON.stringify(pageInfo, null, 2));
        }
        
        try {
          await page.waitForFunction(
            () => {
              // Check for articles, blog links, or substantial headings
              const articleCount = document.querySelectorAll('article').length;
              const blogLinkCount = document.querySelectorAll('a[href*="/blog/"]').length;
              const headingCount = Array.from(document.querySelectorAll('h1, h2, h3, h4')).filter(
                (h) => (h.textContent || '').trim().length > 15
              ).length;
              const textLength = (document.body.innerText || '').length;
              
              // Also check for blog card patterns
              const blogCards = document.querySelectorAll('[class*="blog"], [class*="post"], [class*="article"]').length;
              
              return articleCount > 0 || blogLinkCount > 2 || (headingCount > 2 && textLength > 1000) || blogCards > 0;
            },
            { timeout: 20000 } // Increased timeout
          );
          
          if (isTrainrHub) {
            console.log('[blog-debug] TrainrHub blog content detected, proceeding with extraction');
          }
        } catch (waitError) {
          console.warn(`[blog-extraction] Content wait timeout for ${blogUrl}, proceeding anyway`);
          if (isTrainrHub) {
            console.log('[blog-debug] Proceeding with extraction despite timeout - content may still be loading');
          }
        }
        
        // Additional wait for any lazy-loaded content
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait

        const { posts, totalCount } = await parseBlogPosts(page, blogUrl);
        console.log(`📝 Found ${posts.length} blog posts (estimated total: ${totalCount})`);
        
        if (posts.length > 0) {
          // Analyze actual post content by visiting individual posts
          console.log(`📖 Analyzing content of ${Math.min(posts.length, 10)} blog posts...`);
          const analyzedPosts: Array<{ title: string; url: string; wordCount: number; topics: string[] }> = [];
          
          // Visit up to 10 posts to analyze content (to avoid timeout)
          const postsToAnalyze = posts.slice(0, 10);
          for (const post of postsToAnalyze) {
            try {
              console.log(`  Analyzing: ${post.title.substring(0, 50)}...`);
              await page.goto(post.url, {
                waitUntil: 'domcontentloaded',
                timeout: 10000,
              });
              
              // Wait for content to load
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const postContent = await page.evaluate(() => {
                // Get main content area (article, main, or content div)
                const article = document.querySelector('article, main, [role="main"], [class*="content"], [class*="post-content"]') || document.body;
                const text = (article as HTMLElement).innerText || article.textContent || '';
                const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
                
                // Extract headings for topics
                const headings = Array.from(article.querySelectorAll('h1, h2, h3')).map(h => 
                  (h.textContent || '').trim()
                ).filter(h => h.length > 5 && h.length < 100);
                
                // Extract links to check for internal linking
                const links = Array.from(article.querySelectorAll('a[href]')).map(a => 
                  a.getAttribute('href') || ''
                );
                
                return {
                  wordCount,
                  headings: headings.slice(0, 5),
                  links,
                  textLength: text.length
                };
              });
              
              analyzedPosts.push({
                title: post.title,
                url: post.url,
                wordCount: postContent.wordCount,
                topics: postContent.headings
              });
              
              console.log(`    ✓ ${postContent.wordCount} words, ${postContent.headings.length} headings`);
            } catch (postError) {
              console.warn(`    ⚠ Failed to analyze ${post.url}:`, postError);
              // Continue with other posts
            }
          }
          
          // Navigate back to blog listing page
          await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Use analyzed posts for better insights
          const totalWordCount = analyzedPosts.reduce((sum, p) => sum + p.wordCount, 0);
          const avgWordCount = analyzedPosts.length > 0 ? Math.round(totalWordCount / analyzedPosts.length) : 0;
          
          // Collect all topics from analyzed posts
          const allTopics = analyzedPosts.flatMap(p => p.topics);
          const uniqueTopics = Array.from(new Set(allTopics)).slice(0, 10);
          
          // Use totalCount if available, otherwise use posts.length
          const actualPostCount = totalCount > posts.length ? totalCount : posts.length;
          const latest = posts[0]; // Assuming newest-first order
          
          // Check if posts link to core pages (from analyzed posts)
          const corePagePatterns = ['/about', '/services', '/products', '/pricing', '/contact', '/solutions'];
          const hasInternalLinks = posts.some(p => {
            try {
              const postUrl = new URL(p.url);
              return corePagePatterns.some(pattern => postUrl.pathname.includes(pattern));
            } catch {
              return false;
            }
          });
          
          blogAnalysis = {
            postCount: actualPostCount,
            latestPostDate: latest.publishedAt || undefined,
            postingFrequency: undefined, // Can be filled by LLM later based on dates
            topics: uniqueTopics.length > 0 ? uniqueTopics : undefined,
            hasInternalLinksToCorePages: hasInternalLinks,
            notes: `Found ${actualPostCount} blog post${actualPostCount !== 1 ? 's' : ''}${latest.publishedAt ? `, latest: ${latest.publishedAt}` : ''}${analyzedPosts.length > 0 ? `. Analyzed ${analyzedPosts.length} posts with avg ${avgWordCount} words each.` : ''}`
          };
          
          console.log(`✅ Blog analysis: ${blogAnalysis.postCount} posts, latest: ${blogAnalysis.latestPostDate || 'unknown date'}, analyzed ${analyzedPosts.length} posts`);
          if (isTrainrHub) {
            console.log(`[blog-debug] Blog analysis details:`, JSON.stringify(blogAnalysis, null, 2));
            console.log(`[blog-debug] Analyzed posts:`, analyzedPosts.map(p => ({ title: p.title.substring(0, 40), wordCount: p.wordCount })));
          }
        } else {
          // Blog page exists but no posts - log more details for debugging
          const pageContent = await page.evaluate(() => ({
            bodyText: document.body.innerText?.substring(0, 500),
            articleCount: document.querySelectorAll('article').length,
            linkCount: document.querySelectorAll('a[href*="/blog/"]').length,
            headingCount: document.querySelectorAll('h1, h2, h3, h4').length
          }));
          
          console.log('⚠️  Blog page found but no posts detected. Page content:', JSON.stringify(pageContent, null, 2));
          
          blogAnalysis = {
            postCount: 0,
            latestPostDate: undefined,
            postingFrequency: 'no_recent_posts',
            hasInternalLinksToCorePages: false,
            notes: 'Blog page detected but no posts were found.'
          };
        }
      } catch (error) {
        console.error('❌ Error fetching blog page:', error);
        throw error; // Fail fast - don't continue with partial data
      }
    } else {
      console.log('⚠️  No blog URL detected');
    }

    // Detect LinkedIn and GBP URLs
    const linkedInUrl = await detectLinkedInUrl(page, url);
    const gbpUrl = await detectGbpUrl(page, url);
    
    console.log(`🔍 Brand Authority Detection:`);
    console.log(`   - LinkedIn URL: ${linkedInUrl || 'not found'}`);
    console.log(`   - GBP URL: ${gbpUrl || 'not found'}`);
    
    brandAuthority = {
      linkedin: linkedInUrl
        ? {
            url: linkedInUrl,
            followers: null,
            postingFrequency: null,
            latestPostDate: null,
          }
        : undefined,
      gbp: gbpUrl
        ? {
            url: gbpUrl,
            reviewCount: null,
            rating: null,
            latestReviewDate: null,
          }
        : undefined,
    };

    // If neither LinkedIn nor GBP found, set to null
    if (!brandAuthority.linkedin && !brandAuthority.gbp) {
      brandAuthority = null;
      console.log(`   ⚠️  No brand authority profiles detected`);
    } else {
      console.log(`   ✅ Brand authority data populated`);
    }
  } catch (error) {
    console.error('Error in browser detection:', error);
    // Set analytics to null to indicate "unknown" status
    analyticsAnalysis = null;
  } finally {
    await page.close();
  }

  return {
    blogAnalysis,
    analyticsAnalysis,
    brandAuthority,
  };
}

