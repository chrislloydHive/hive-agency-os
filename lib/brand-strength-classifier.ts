/**
 * Brand Strength Classifier
 * 
 * Classifies websites into brand strength tiers to calibrate scoring appropriately.
 * Iconic brands like Apple, Nike, Tesla should receive different scoring baselines
 * than smaller businesses.
 */

import OpenAI from 'openai';
import { env } from './env';

// Lazy initialization to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export type BrandStrength = 
  | 'global_iconic'
  | 'major_established'
  | 'mid_market'
  | 'early_stage_startup'
  | 'small_local_business';

export interface BrandStrengthResult {
  brand_strength: BrandStrength;
  confidence: number; // 0-1
  reasoning: string;
}

/**
 * Classify brand strength based on domain and website content
 * 
 * @param domain - The website domain (e.g., "apple.com")
 * @param htmlHint - HTML content hint from the website
 * @param companyName - Company name extracted from the website (optional)
 * @returns Brand strength classification result
 */
export async function classifyBrandStrength(
  domain: string,
  htmlHint?: string,
  companyName?: string
): Promise<BrandStrengthResult> {
  const openai = getOpenAI();
  
  // Extract domain name without protocol
  const domainName = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  
  // Build context for classification
  const context = [
    `Domain: ${domainName}`,
    companyName ? `Company Name: ${companyName}` : null,
    htmlHint ? `Website Content Sample: ${htmlHint.substring(0, 2000)}` : null,
  ].filter(Boolean).join('\n\n');
  
  const prompt = `You are a brand recognition classifier. Analyze the provided domain and website content to determine the brand strength tier.

Domain and Context:
${context}

Classify this brand into ONE of these tiers:

1. **global_iconic**: Globally recognized brands with massive brand equity (e.g., Apple, Nike, Tesla, Disney, Coca-Cola, Microsoft, Amazon, Google, McDonald's, Starbucks, BMW, Mercedes-Benz, Louis Vuitton, Gucci, Chanel, Rolex, etc.)

2. **major_established**: Large, well-established brands but not at global iconic status (e.g., regional market leaders, well-known B2B companies, successful mid-size enterprises with strong brand recognition in their industry)

3. **mid_market**: Established businesses with moderate brand recognition (e.g., successful regional companies, growing B2B brands, established local chains)

4. **early_stage_startup**: New or emerging companies (e.g., startups, new ventures, companies with limited brand recognition)

5. **small_local_business**: Small local businesses (e.g., local shops, small service providers, mom-and-pop businesses)

Return JSON only:
{
  "brand_strength": "global_iconic" | "major_established" | "mid_market" | "early_stage_startup" | "small_local_business",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this classification was chosen"
}

Guidelines:
- Use "global_iconic" only for brands that are truly globally recognized household names
- Use "major_established" for brands that are well-known in their industry or region but not globally iconic
- Be conservative with "global_iconic" - err on the side of "major_established" if uncertain
- Confidence should reflect how certain you are (0.8+ for obvious cases, 0.5-0.7 for borderline cases)`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a brand recognition classifier. Return only valid JSON, no markdown, no explanations outside the JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistent classification
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const result = JSON.parse(content) as BrandStrengthResult;
    
    // Validate result
    const validStrengths: BrandStrength[] = [
      'global_iconic',
      'major_established',
      'mid_market',
      'early_stage_startup',
      'small_local_business',
    ];
    
    if (!validStrengths.includes(result.brand_strength)) {
      console.warn(`⚠️  Invalid brand_strength "${result.brand_strength}", defaulting to "mid_market"`);
      result.brand_strength = 'mid_market';
    }
    
    // Clamp confidence to 0-1
    result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
    
    return result;
  } catch (error) {
    console.error('❌ Brand strength classification failed:', error);
    // Return default classification on error
    return {
      brand_strength: 'mid_market',
      confidence: 0.5,
      reasoning: 'Classification failed, using default mid_market tier',
    };
  }
}

