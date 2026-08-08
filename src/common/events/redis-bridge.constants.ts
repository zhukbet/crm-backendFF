export const DOMAIN_EVENTS_CHANNEL = 'domain-events';

export interface BridgedEventEnvelope {
  event: string;
  data: unknown;
}
