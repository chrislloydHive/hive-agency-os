// lib/contextGraph/collaboration/index.ts
// Collaboration module exports

// Types
export type {
  UserPresenceState,
  EditLock,
  EditConflict,
  MergeSuggestion,
} from './presence';

// Presence management
export {
  addUserPresence,
  removeUserPresence,
  updateUserFocus,
  getCompanyUsers,
  getDomainViewers,
  getPathEditor,
} from './presence';

// Edit lock management
export {
  acquireEditLock,
  releaseEditLock,
  extendEditLock,
  isPathLocked,
} from './presence';

// Conflict resolution
export {
  createConflict,
  getPendingConflicts,
  resolveConflict,
  generateMergeSuggestion,
} from './presence';

// Activity & cleanup
export {
  updateActivityStatus,
  cleanupExpired,
  getCollaborationStats,
} from './presence';
