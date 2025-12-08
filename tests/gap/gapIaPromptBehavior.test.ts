// tests/gap/gapIaPromptBehavior.test.ts
// Tests to verify the GAP IA prompt contains required anti-hallucination rules

import { describe, it, expect } from 'vitest';
import { GAP_IA_OUTPUT_PROMPT_V3 } from '@/lib/gap/prompts/gapIaOutputPromptV3';

describe('GAP IA Prompt Anti-Hallucination Rules', () => {
  const prompt = GAP_IA_OUTPUT_PROMPT_V3;

  // ============================================================================
  // GBP Anti-Hallucination Rules
  // ============================================================================
  describe('GBP Anti-Hallucination Rules', () => {
    it('should contain GBP grounding rules section', () => {
      expect(prompt).toContain('GBP ANTI-HALLUCINATION RULES');
    });

    it('should instruct not to recommend setting up GBP when present', () => {
      expect(prompt).toContain('socialFootprint.gbp.status is "present"');
      expect(prompt).toContain('NEVER recommend');
      expect(prompt).toContain('Set up a Google Business Profile');
    });

    it('should include forbidden phrases for GBP', () => {
      expect(prompt).toContain('"Create a Google Business Profile"');
      expect(prompt).toContain('"Claim your Google Business Profile"');
      expect(prompt).toContain('"Establish a Google Business Profile"');
    });

    it('should recommend optimization when GBP is present', () => {
      expect(prompt).toContain('INSTEAD recommend optimizing');
      expect(prompt).toContain('Optimize the existing GBP');
    });

    it('should handle missing GBP with high confidence', () => {
      expect(prompt).toContain('socialFootprint.gbp.status is "missing"');
      expect(prompt).toContain('socialFootprint.dataConfidence >= 0.7');
      expect(prompt).toContain('You MAY recommend setting up a GBP');
    });

    it('should handle missing GBP with low confidence', () => {
      expect(prompt).toContain('socialFootprint.dataConfidence < 0.7');
      expect(prompt).toContain('Use conditional language');
      expect(prompt).toContain("If a Google Business Profile doesn't already exist");
    });

    it('should handle inconclusive GBP status', () => {
      expect(prompt).toContain('inconclusive');
      expect(prompt).toContain('Use uncertain language');
    });
  });

  // ============================================================================
  // Social Platform Anti-Hallucination Rules
  // ============================================================================
  describe('Social Platform Anti-Hallucination Rules', () => {
    it('should contain social platform grounding rules section', () => {
      expect(prompt).toContain('SOCIAL PLATFORM ANTI-HALLUCINATION RULES');
    });

    it('should instruct not to recommend starting socials when present', () => {
      expect(prompt).toContain('status is "present" or "probable"');
      expect(prompt).toContain('NEVER recommend');
      expect(prompt).toContain('Start an Instagram presence');
    });

    it('should include forbidden phrases for socials', () => {
      expect(prompt).toContain('"Create a LinkedIn company page"');
      expect(prompt).toContain('"Launch a [network] presence"');
    });

    it('should recommend strengthening when socials are present', () => {
      expect(prompt).toContain('INSTEAD recommend strengthening/optimizing');
      expect(prompt).toContain('Improve Instagram posting cadence');
    });

    it('should handle missing socials with high confidence', () => {
      expect(prompt).toContain('You MAY recommend starting that presence');
    });

    it('should handle missing socials with low confidence', () => {
      expect(prompt).toContain('If not already active on Instagram');
    });
  });

  // ============================================================================
  // Data Confidence Rules
  // ============================================================================
  describe('Data Confidence Rules', () => {
    it('should contain data confidence caveat rules', () => {
      expect(prompt).toContain('DATA CONFIDENCE CAVEAT RULES');
    });

    it('should instruct to add caveats for low confidence', () => {
      expect(prompt).toContain('socialFootprint.dataConfidence < 0.5');
      expect(prompt).toContain('limited');
      expect(prompt).toContain('manual verification');
    });

    it('should allow confident assertions for high confidence', () => {
      expect(prompt).toContain('socialFootprint.dataConfidence >= 0.7');
      expect(prompt).toContain('confident assertions');
    });
  });

  // ============================================================================
  // socialFootprint Structure Documentation
  // ============================================================================
  describe('socialFootprint Structure Documentation', () => {
    it('should document the socialFootprint structure', () => {
      expect(prompt).toContain('"socialFootprint"');
      expect(prompt).toContain('"dataConfidence"');
      expect(prompt).toContain('"socials"');
      expect(prompt).toContain('"network"');
      expect(prompt).toContain('"status"');
      expect(prompt).toContain('"confidence"');
    });

    it('should document valid status values', () => {
      expect(prompt).toContain('"present"');
      expect(prompt).toContain('"probable"');
      expect(prompt).toContain('"inconclusive"');
      expect(prompt).toContain('"missing"');
    });

    it('should include example with Atlas-like data', () => {
      // The prompt should include example data that looks like Atlas
      expect(prompt).toContain('atlasskateboarding');
    });
  });

  // ============================================================================
  // Legacy Support
  // ============================================================================
  describe('Legacy digitalFootprint Support', () => {
    it('should maintain backward compatibility with digitalFootprint', () => {
      expect(prompt).toContain('LEGACY DIGITAL FOOTPRINT SUPPORT');
      expect(prompt).toContain('digitalFootprint.gbp.found');
      expect(prompt).toContain('digitalFootprint.linkedin.found');
    });

    it('should map legacy format to new rules', () => {
      expect(prompt).toContain('Same rules as socialFootprint');
    });
  });

  // ============================================================================
  // Critical Reminder
  // ============================================================================
  describe('Critical Reminders', () => {
    it('should include ground truth reminder', () => {
      expect(prompt).toContain('GROUND TRUTH');
    });

    it('should emphasize never contradicting signals', () => {
      expect(prompt).toContain('Never contradict the signals');
    });
  });
});

describe('GAP IA Prompt Structure', () => {
  const prompt = GAP_IA_OUTPUT_PROMPT_V3;

  it('should be a non-empty string', () => {
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(1000);
  });

  it('should include all major sections', () => {
    const sections = [
      'YOUR ROLE',
      'OUTPUT STRUCTURE',
      'SOCIAL FOOTPRINT GROUNDING RULES',
      'GBP ANTI-HALLUCINATION RULES',
      'SOCIAL PLATFORM ANTI-HALLUCINATION RULES',
      'TONE & STYLE',
      'VALIDATION CHECKLIST',
    ];

    for (const section of sections) {
      expect(prompt).toContain(section);
    }
  });

  it('should enforce third-person voice', () => {
    expect(prompt).toContain('Third-person voice');
    expect(prompt).toContain('NEVER "you"');
  });

  it('should specify exactly 6 dimensions', () => {
    expect(prompt).toContain('EXACTLY 6 dimensions');
    expect(prompt).toContain('brand');
    expect(prompt).toContain('content');
    expect(prompt).toContain('seo');
    expect(prompt).toContain('website');
    expect(prompt).toContain('digitalFootprint');
    expect(prompt).toContain('authority');
  });
});
