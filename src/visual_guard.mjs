/**
 * VisualGuard — Edge Computer Vision & Spatial Guardrail Gateway
 * Main runtime coordinator
 */

import { SpatialBoundaryEngine } from './spatial_boundary.mjs';
import { VisualInjectionDetector } from './injection_detector.mjs';
import { PrivacyRedactor } from './privacy_redactor.mjs';
import { PerceptionOptimizer } from './perception_optimizer.mjs';
import { VisualAuditChain } from './audit_chain.mjs';

export class VisualGuard {
  constructor(config = {}) {
    this.spatial = new SpatialBoundaryEngine(config.spatial);
    this.injection = new VisualInjectionDetector(config.injection);
    this.privacy = new PrivacyRedactor(config.privacy);
    this.optimizer = new PerceptionOptimizer(config.optimizer);
    this.audit = new VisualAuditChain();
  }

  /**
   * Evaluates an agent's intended physical / robotic action against spatial safety rules
   */
  validateSpatialAction(action) {
    const result = this.spatial.evaluateSpatialAction(action);
    this.audit.append(
      result.approved ? 'SPATIAL_ACTION_APPROVED' : 'SPATIAL_ACTION_BLOCKED',
      { action, result }
    );
    return result;
  }

  /**
   * Inspects OCR or perceived text for visual prompt injection attacks
   */
  inspectTextSafety(rawText) {
    const result = this.injection.inspectText(rawText);
    if (result.isMalicious) {
      this.audit.append('VISUAL_INJECTION_BLOCKED', { rawText, result });
    }
    return result;
  }

  /**
   * Inspects QR / Barcode for adversarial SSRF or injection payloads
   */
  inspectQRSafety(payload) {
    const result = this.injection.inspectQRPayload(payload);
    if (result.isMalicious) {
      this.audit.append('ADVERSARIAL_QR_BLOCKED', { payload, result });
    }
    return result;
  }

  /**
   * Redacts sensitive visual detections (faces, plates, credentials)
   */
  redactDetections(detections) {
    const result = this.privacy.redactDetections(detections);
    const countRedacted = result.filter((d) => d.redacted).length;
    if (countRedacted > 0) {
      this.audit.append('PRIVACY_REDACTION_APPLIED', { countRedacted });
    }
    return result;
  }

  /**
   * Evaluates a frame for temporal deduplication before cloud dispatch
   */
  evaluateCloudFrameDispatch(pixelGrid9x8) {
    const result = this.optimizer.evaluateFrame(pixelGrid9x8);
    this.audit.append('PERCEPTION_DEDUPLICATION_EVALUATED', {
      dispatch: result.dispatchToCloud,
      savingsRate: result.savingsRate,
    });
    return result;
  }

  /**
   * Verifies the cryptographic audit chain
   */
  verifyAuditIntegrity() {
    return this.audit.verifyChain();
  }
}
