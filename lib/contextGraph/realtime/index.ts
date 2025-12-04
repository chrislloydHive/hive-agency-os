// lib/contextGraph/realtime/index.ts
// Real-time streaming exports

// Types
export type {
  RealtimeEventType,
  RealtimeEventBase,
  FieldUpdateEvent,
  FieldLockEvent,
  UserPresenceEvent,
  UserCursorEvent,
  ValidationEvent,
  HealthEvent,
  SuggestionEvent,
  HealingEvent,
  RealtimeEvent,
  SubscriptionOptions,
  ActiveSubscription,
  UserPresence,
  CompanyPresence,
  ClientMessage,
  ServerMessage,
} from './types';

// Server-side functions
export {
  createSubscription,
  removeSubscription,
  getSubscription,
  touchSubscription,
  getCompanyPresence,
  updateUserCursor,
  startUserEditing,
  stopUserEditing,
  registerEventHandler,
  broadcastToCompany,
  broadcastFieldUpdate,
  getFieldEditor,
  checkEditConflict,
  cleanupStaleSubscriptions,
  getConnectionStats,
} from './server';

// Client-side functions and classes
export {
  RealtimeClient,
  getRealtimeClient,
  createFieldHighlight,
  type RealtimeClientConfig,
  type ConnectionStatus,
  type FieldHighlight,
} from './client';
