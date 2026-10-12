/**
 * VisualGuard Tamper-Evident SHA-256 Audit Chain
 * Links all perception and spatial action decisions in an append-only cryptographic chain
 */

import { createHash } from 'node:crypto';

export class VisualAuditChain {
  constructor() {
    this.chain = [];
    this.genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
  }

  /**
   * Appends an audit entry and calculates linked SHA-256 hash
   */
  append(entryType, details) {
    const prevHash =
      this.chain.length === 0
        ? this.genesisHash
        : this.chain[this.chain.length - 1].hash;

    const timestamp = Date.now();
    const payload = JSON.stringify({
      index: this.chain.length,
      prevHash,
      entryType,
      details,
      timestamp,
    });

    const hash = createHash('sha256').update(payload).digest('hex');

    const entry = {
      index: this.chain.length,
      prevHash,
      hash,
      entryType,
      details,
      timestamp,
    };

    this.chain.push(entry);
    return entry;
  }

  /**
   * Verifies the cryptographic integrity of the entire chain
   */
  verifyChain() {
    for (let i = 0; i < this.chain.length; i++) {
      const current = this.chain[i];
      const expectedPrevHash =
        i === 0 ? this.genesisHash : this.chain[i - 1].hash;

      if (current.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          errorIndex: i,
          reason: `Broken prevHash link at block ${i}`,
        };
      }

      const payload = JSON.stringify({
        index: current.index,
        prevHash: current.prevHash,
        entryType: current.entryType,
        details: current.details,
        timestamp: current.timestamp,
      });

      const calculatedHash = createHash('sha256').update(payload).digest('hex');
      if (calculatedHash !== current.hash) {
        return {
          valid: false,
          errorIndex: i,
          reason: `Tampered payload hash at block ${i}`,
        };
      }
    }

    return {
      valid: true,
      length: this.chain.length,
      headHash: this.chain.length > 0 ? this.chain[this.chain.length - 1].hash : null,
    };
  }

  /**
   * Retrieves log of recent security events
   */
  getEvents() {
    return [...this.chain];
  }
}
