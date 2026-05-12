/**
 * VERA Module Index
 * Exports all Verifiable Enforcement for Runtime Agents (VERA) services.
 *
 * @see VERA Paper — Berlin AI Labs (2026)
 */

// Types
export type { AgentMaturityLevel, AgentMaturity, PromotionGateResults, GateResult, LevelTransition } from './maturity.types';
export { MATURITY_LEVELS, MATURITY_LEVEL_META } from './maturity.types';
export type { SegmentationPolicy, ResourcePolicy, RateLimitPolicy, TransactionLimit } from './segmentation.types';
export { DEFAULT_POLICIES } from './segmentation.types';
export type { CircuitBreaker, CircuitState, KillSwitchState, IncidentRecord } from './incident.service';

// Services
export { MaturityService } from './maturity.service';
export { SegmentationService } from './segmentation.service';
export type { AccessRequest, AccessDecision } from './segmentation.service';
export { IncidentResponseService } from './incident.service';
