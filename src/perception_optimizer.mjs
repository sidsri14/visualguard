/**
 * VisualGuard Cloud-Optimized OpenCV (COOL) Perception Optimizer
 * Perceptual hashing (dHash) and temporal frame deduplication for AWS VLM savings
 */

import { createHash } from 'node:crypto';

export class PerceptionOptimizer {
  constructor(options = {}) {
    this.hashThreshold = options.hashThreshold || 4; // Max hamming distance considered duplicate
    this.lastHash = null;
    this.totalFramesProcessed = 0;
    this.framesDropped = 0;
  }

  /**
   * Computes an 8x8 difference hash (dHash) from a grayscale 9x8 pixel array
   * dHash tracks relative gradients across adjacent pixels
   */
  computeDHash(pixelGrid9x8) {
    if (!Array.isArray(pixelGrid9x8) || pixelGrid9x8.length !== 8) {
      throw new Error('dHash requires an 8-row grid with 9 columns each');
    }

    let hashBits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = pixelGrid9x8[row][col];
        const right = pixelGrid9x8[row][col + 1];
        hashBits += left < right ? '1' : '0';
      }
    }

    // Convert 64 bits to 16-character hex
    let hexString = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = hashBits.substring(i, i + 4);
      hexString += parseInt(nibble, 2).toString(16);
    }
    return hexString;
  }

  /**
   * Computes Hamming distance between two hex hashes
   */
  hammingDistance(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;

    let dist = 0;
    for (let i = 0; i < hash1.length; i++) {
      const v1 = parseInt(hash1[i], 16);
      const v2 = parseInt(hash2[i], 16);
      let xor = v1 ^ v2;
      while (xor > 0) {
        dist += xor & 1;
        xor >>= 1;
      }
    }
    return dist;
  }

  /**
   * Evaluates if an incoming frame should be dispatched to AWS VLM or cached/dropped
   */
  evaluateFrame(pixelGrid9x8) {
    this.totalFramesProcessed++;
    const currentHash = this.computeDHash(pixelGrid9x8);

    if (!this.lastHash) {
      this.lastHash = currentHash;
      return {
        dispatchToCloud: true,
        reason: 'FIRST_KEYFRAME',
        hash: currentHash,
        hammingDistance: 64,
        savingsRate: 0,
      };
    }

    const distance = this.hammingDistance(this.lastHash, currentHash);
    const isDuplicate = distance <= this.hashThreshold;

    if (isDuplicate) {
      this.framesDropped++;
      const savingsRate = (this.framesDropped / this.totalFramesProcessed) * 100;
      return {
        dispatchToCloud: false,
        reason: `TEMPORAL_DEDUPLICATION_HIT (Hamming ${distance} <= ${this.hashThreshold})`,
        hash: currentHash,
        hammingDistance: distance,
        savingsRate: Number(savingsRate.toFixed(1)),
      };
    }

    this.lastHash = currentHash;
    const savingsRate = (this.framesDropped / this.totalFramesProcessed) * 100;
    return {
      dispatchToCloud: true,
      reason: `SCENE_CHANGE_DETECTED (Hamming ${distance} > ${this.hashThreshold})`,
      hash: currentHash,
      hammingDistance: distance,
      savingsRate: Number(savingsRate.toFixed(1)),
    };
  }

  /**
   * Computes SHA-256 frame payload attestation
   */
  hashFramePayload(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
