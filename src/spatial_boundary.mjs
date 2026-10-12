/**
 * VisualGuard Spatial Boundary & Geofence Engine
 * Deterministic spatial invariants for Physical AI, robotics, and Agentic Vision
 */

export class SpatialBoundaryEngine {
  constructor(options = {}) {
    this.workspaceEnvelope = options.workspaceEnvelope || {
      minX: 0,
      maxX: 1920,
      minY: 0,
      maxY: 1080,
      minZ: 0,
      maxZ: 1000,
    };
    this.exclusionZones = options.exclusionZones || [];
    this.maxVelocityUnitsPerSec = options.maxVelocityUnitsPerSec || 500;
    this.lastCoordinates = null;
    this.lastTimestamp = null;
  }

  /**
   * Registers a forbidden hazard / human exclusion polygon
   */
  addExclusionZone(zone) {
    if (!zone.id || !Array.isArray(zone.polygon) || zone.polygon.length < 3) {
      throw new Error('Exclusion zone must have an id and polygon with at least 3 points');
    }
    this.exclusionZones.push(zone);
  }

  /**
   * Ray-casting point-in-polygon test
   */
  isPointInPolygon(point, polygon) {
    const { x, y } = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Evaluates if a bounding box intersects an exclusion zone
   */
  boxIntersectsPolygon(box, polygon) {
    const corners = [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
      { x: box.x, y: box.y + box.height },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    ];

    for (const corner of corners) {
      if (this.isPointInPolygon(corner, polygon)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Verifies if a proposed robot / agent spatial action is within safe envelopes
   */
  evaluateSpatialAction(action) {
    const { targetX, targetY, targetZ = 0, timestamp = Date.now() } = action;

    if (
      typeof targetX !== 'number' ||
      typeof targetY !== 'number' ||
      isNaN(targetX) ||
      isNaN(targetY)
    ) {
      return {
        approved: false,
        reason: 'INVALID_COORDINATES: Coordinates must be valid numeric values',
      };
    }

    // Check workspace envelope boundaries
    const env = this.workspaceEnvelope;
    if (
      targetX < env.minX ||
      targetX > env.maxX ||
      targetY < env.minY ||
      targetY > env.maxY ||
      targetZ < env.minZ ||
      targetZ > env.maxZ
    ) {
      return {
        approved: false,
        reason: `WORKSPACE_ENVELOPE_BREACH: Target (${targetX}, ${targetY}, ${targetZ}) is outside allowed bounds [${env.minX}..${env.maxX}, ${env.minY}..${env.maxY}, ${env.minZ}..${env.maxZ}]`,
      };
    }

    // Check exclusion zones (human safety / hazard areas)
    for (const zone of this.exclusionZones) {
      if (this.isPointInPolygon({ x: targetX, y: targetY }, zone.polygon)) {
        return {
          approved: false,
          reason: `EXCLUSION_ZONE_VIOLATION: Target coordinate enters forbidden hazard area '${zone.id}'`,
        };
      }
    }

    // Check velocity limit if sequential timestamps exist
    if (this.lastCoordinates && this.lastTimestamp && timestamp > this.lastTimestamp) {
      const dtSec = (timestamp - this.lastTimestamp) / 1000;
      if (dtSec > 0) {
        const dx = targetX - this.lastCoordinates.x;
        const dy = targetY - this.lastCoordinates.y;
        const dz = targetZ - this.lastCoordinates.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const velocity = distance / dtSec;

        if (velocity > this.maxVelocityUnitsPerSec) {
          return {
            approved: false,
            reason: `ACTUATOR_VELOCITY_OVERRUN: Commanded speed ${velocity.toFixed(1)} u/s exceeds safety ceiling ${this.maxVelocityUnitsPerSec} u/s`,
          };
        }
      }
    }

    // Record valid movement
    this.lastCoordinates = { x: targetX, y: targetY, z: targetZ };
    this.lastTimestamp = timestamp;

    return {
      approved: true,
      reason: 'SPATIAL_SAFETY_VERIFIED',
    };
  }

  /**
   * Verifies if a detected object bounding box violates physical boundaries
   */
  evaluateBoundingBox(box) {
    if (box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0) {
      return { approved: false, reason: 'INVALID_BOUNDING_BOX' };
    }

    for (const zone of this.exclusionZones) {
      if (this.boxIntersectsPolygon(box, zone.polygon)) {
        return {
          approved: false,
          reason: `BOUNDING_BOX_EXCLUSION_BREACH: Object intersects zone '${zone.id}'`,
        };
      }
    }

    return { approved: true, reason: 'BOUNDING_BOX_SAFE' };
  }
}
