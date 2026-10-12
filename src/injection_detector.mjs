/**
 * VisualGuard Visual Prompt Injection & Adversarial Text Detector
 * Inspects OCR text and QR code payloads extracted from scene frames
 */

export class VisualInjectionDetector {
  constructor(options = {}) {
    this.customPatterns = options.customPatterns || [];
    this.blockedKeywords = [
      /\bignore\s+(all\s+)?(previous|prior|above)\s+instructions\b/i,
      /\bdisregard\s+(all\s+)?(safety|rules|instructions)\b/i,
      /\bnew\s+system\s+directive\b/i,
      /\boverride\s+(safety|interlock|limits|protocol)\b/i,
      /\bact\s+as\s+(dan|unrestricted|jailbreak)\b/i,
      /\bdisable\s+(alarm|sensor|interlock|guard)\b/i,
      /\bemergency\s+(override|release|bypass)\b/i,
      /\b(rm\s+-rf|sudo\s+|curl\s+http|wget\s+http)\b/i,
      /\b(drop\s+database|exec\s+xp_cmdshell)\b/i,
    ];
  }

  /**
   * Normalizes text by removing leetspeak and zero-width characters
   */
  normalizeText(input) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width
      .replace(/1/g, 'i')
      .replace(/0/g, 'o')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/@/g, 'a')
      .replace(/\$/g, 's')
      .toLowerCase();
  }

  /**
   * Evaluates text extracted from OCR or scene perception
   */
  inspectText(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { isMalicious: false, detections: [] };
    }

    const detections = [];
    const normalized = this.normalizeText(rawText);

    for (const pattern of this.blockedKeywords) {
      if (pattern.test(rawText) || pattern.test(normalized)) {
        detections.push({
          type: 'VISUAL_PROMPT_INJECTION',
          pattern: pattern.toString(),
          snippet: rawText.substring(0, 100),
        });
      }
    }

    for (const pattern of this.customPatterns) {
      if (pattern.test(rawText) || pattern.test(normalized)) {
        detections.push({
          type: 'CUSTOM_THREAT_PATTERN',
          pattern: pattern.toString(),
          snippet: rawText.substring(0, 100),
        });
      }
    }

    return {
      isMalicious: detections.length > 0,
      detections,
      quarantined: detections.length > 0,
    };
  }

  /**
   * Evaluates QR code or barcode payload
   */
  inspectQRPayload(payload) {
    if (!payload || typeof payload !== 'string') {
      return { isMalicious: false, reason: 'EMPTY_PAYLOAD' };
    }

    // SSRF / Localhost redirect check
    const ssrfPatterns = [
      /http:\/\/(169\.254\.169\.254|metadata\.google\.internal)/i,
      /http:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)/i,
      /http:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/,
    ];

    for (const p of ssrfPatterns) {
      if (p.test(payload)) {
        return {
          isMalicious: true,
          type: 'ADVERSARIAL_QR_SSRF',
          reason: 'QR payload contains internal network / metadata SSRF target',
        };
      }
    }

    // Text injection in QR
    const textCheck = this.inspectText(payload);
    if (textCheck.isMalicious) {
      return {
        isMalicious: true,
        type: 'ADVERSARIAL_QR_INJECTION',
        detections: textCheck.detections,
      };
    }

    return { isMalicious: false, reason: 'QR_PAYLOAD_SAFE' };
  }
}
