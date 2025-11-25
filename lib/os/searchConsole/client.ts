// lib/os/searchConsole/client.ts
// Search Console Client - Re-exports from integrations for cleaner imports

export {
  getGscClientFromWorkspace,
  isGscConfigured,
  getGscConnectionStatus,
  listGscSites,
} from '../integrations/gscClient';
