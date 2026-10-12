/**
 * VisualGuard Privacy Redactor & Credential Masking Engine
 * Redacts PII, monitor credentials, and faces before transmission to cloud VLMs
 */

export class PrivacyRedactor {
  constructor(options = {}) {
    this.redactTypes = new Set(
      options.redactTypes || ['FACE', 'LICENSE_PLATE', 'ID_BADGE', 'CREDENTIAL_SCREEN']
    );
  }

  /**
   * Evaluates detected objects and filters/redacts privacy-sensitive items
   */
  redactDetections(detections) {
    if (!Array.isArray(detections)) return [];

    return detections.map((det) => {
      const isSensitive = this.redactTypes.has(det.type);
      return {
        ...det,
        redacted: isSensitive,
        action: isSensitive ? 'APPLY_MASK' : 'PASS_THROUGH',
        maskType: isSensitive ? 'SOLID_BLACKOUT' : 'NONE',
      };
    });
  }

  /**
   * Applies pixel-level blackout mask to a raw image buffer (RGBA / Grayscale)
   * width, height, stride
   */
  maskPixelBuffer(buffer, width, height, boundingBoxes) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Image buffer must be a Node.js Buffer');
    }

    const channels = buffer.length / (width * height);
    if (![1, 3, 4].includes(channels)) {
      throw new Error(`Unsupported channel depth: ${channels}`);
    }

    const copy = Buffer.from(buffer);

    for (const box of boundingBoxes) {
      const startX = Math.max(0, Math.floor(box.x));
      const endX = Math.min(width, Math.floor(box.x + box.width));
      const startY = Math.max(0, Math.floor(box.y));
      const endY = Math.min(height, Math.floor(box.y + box.height));

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const index = (y * width + x) * channels;
          for (let c = 0; c < Math.min(channels, 3); c++) {
            copy[index + c] = 0; // Blackout
          }
          if (channels === 4) {
            copy[index + 3] = 255; // Alpha opaque
          }
        }
      }
    }

    return copy;
  }

  /**
   * Checks if OCR text contains cloud / secret credentials that require masking
   */
  detectCredentialInText(text) {
    const credentialPatterns = [
      /\b(AKIA[0-9A-Z]{16})\b/g, // AWS Access Key
      /\b(sk-[a-zA-Z0-9]{32,})\b/g, // OpenAI secret key
      /\b(ghp_[a-zA-Z0-9]{36})\b/g, // GitHub PAT
      /\b(xox[baprs]-[0-9a-zA-Z-]{24,})\b/g, // Slack token
      /\b[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b/g, // JWT
    ];

    let containsCredentials = false;
    let sanitizedText = text;

    for (const pattern of credentialPatterns) {
      if (pattern.test(sanitizedText)) {
        containsCredentials = true;
        sanitizedText = sanitizedText.replace(pattern, '[REDACTED_SECRET]');
      }
    }

    return {
      containsCredentials,
      sanitizedText,
    };
  }
}
