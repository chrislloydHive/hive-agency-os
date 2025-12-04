// lib/contextGraph/realtime/client.ts
// Real-time client for Context Graph streaming
//
// Phase 4: Client-side WebSocket/SSE connection management
// Provides React hooks and utilities for real-time updates

import type {
  RealtimeEvent,
  SubscriptionOptions,
  CompanyPresence,
  UserPresence,
  ClientMessage,
  ServerMessage,
  RealtimeEventType,
} from './types';
import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Client Configuration
// ============================================================================

export interface RealtimeClientConfig {
  /** Base URL for the streaming endpoint */
  baseUrl?: string;
  /** Reconnection options */
  reconnect?: {
    enabled: boolean;
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  /** Heartbeat interval in ms */
  heartbeatIntervalMs?: number;
  /** Activity timeout in ms (user becomes 'idle') */
  activityTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<RealtimeClientConfig> = {
  baseUrl: '/api/context/stream',
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  },
  heartbeatIntervalMs: 30000,
  activityTimeoutMs: 60000,
};

// ============================================================================
// Event Emitter
// ============================================================================

type EventCallback<T = unknown> = (data: T) => void;

class EventEmitter {
  private listeners = new Map<string, Set<EventCallback>>();

  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback);
    };
  }

  off<T>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback as EventCallback);
  }

  emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[realtime-client] Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// Realtime Client Class
// ============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export class RealtimeClient extends EventEmitter {
  private config: Required<RealtimeClientConfig>;
  private eventSource: EventSource | null = null;
  private subscriptionId: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activityTimeout: NodeJS.Timeout | null = null;
  private _status: ConnectionStatus = 'disconnected';
  private _presence: CompanyPresence | null = null;
  private options: SubscriptionOptions | null = null;

  constructor(config: RealtimeClientConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get presence(): CompanyPresence | null {
    return this._presence;
  }

  get isConnected(): boolean {
    return this._status === 'connected';
  }

  /**
   * Connect to the real-time stream for a company
   */
  async connect(options: SubscriptionOptions): Promise<void> {
    if (this._status === 'connecting' || this._status === 'connected') {
      console.warn('[realtime-client] Already connected or connecting');
      return;
    }

    this.options = options;
    this._status = 'connecting';
    this.emit('status', this._status);

    try {
      await this.establishConnection();
    } catch (error) {
      this._status = 'error';
      this.emit('status', this._status);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from the real-time stream
   */
  disconnect(): void {
    this.cleanup();
    this._status = 'disconnected';
    this._presence = null;
    this.subscriptionId = null;
    this.options = null;
    this.emit('status', this._status);
  }

  /**
   * Send cursor movement update
   */
  moveCursor(domain?: DomainName, path?: string): void {
    this.sendMessage({ type: 'cursor_move', domain, path });
    this.resetActivityTimeout();
  }

  /**
   * Notify server that user started editing a field
   */
  startEditing(path: string): void {
    this.sendMessage({ type: 'start_editing', path });
    this.resetActivityTimeout();
  }

  /**
   * Notify server that user stopped editing a field
   */
  stopEditing(path: string): void {
    this.sendMessage({ type: 'stop_editing', path });
    this.resetActivityTimeout();
  }

  /**
   * Subscribe to specific event types
   */
  onEvent(eventType: RealtimeEventType, callback: (event: RealtimeEvent) => void): () => void {
    return this.on(`event:${eventType}`, callback);
  }

  /**
   * Subscribe to all events
   */
  onAnyEvent(callback: (event: RealtimeEvent) => void): () => void {
    return this.on('event', callback);
  }

  /**
   * Subscribe to presence updates
   */
  onPresenceUpdate(callback: (presence: CompanyPresence) => void): () => void {
    return this.on('presence', callback);
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    return this.on('status', callback);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async establishConnection(): Promise<void> {
    if (!this.options) {
      throw new Error('No subscription options provided');
    }

    // Build URL with query params
    const params = new URLSearchParams({
      companyId: this.options.companyId,
      userId: this.options.userId,
      userName: this.options.userName,
    });

    if (this.options.userAvatar) {
      params.set('userAvatar', this.options.userAvatar);
    }
    if (this.options.domains?.length) {
      params.set('domains', this.options.domains.join(','));
    }
    if (this.options.eventTypes?.length) {
      params.set('eventTypes', this.options.eventTypes.join(','));
    }

    const url = `${this.config.baseUrl}?${params.toString()}`;

    // Create EventSource for SSE
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this._status = 'connected';
      this.reconnectAttempt = 0;
      this.emit('status', this._status);
      this.startHeartbeat();
      this.resetActivityTimeout();
    };

    this.eventSource.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        this.handleServerMessage(message);
      } catch (error) {
        console.error('[realtime-client] Failed to parse message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('[realtime-client] EventSource error:', error);

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.handleDisconnect();
      }
    };
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'subscribed':
        this.subscriptionId = message.subscriptionId;
        this._presence = message.presence;
        this.emit('subscribed', { subscriptionId: this.subscriptionId });
        this.emit('presence', this._presence);
        break;

      case 'unsubscribed':
        this.subscriptionId = null;
        break;

      case 'event':
        this.emit('event', message.event);
        this.emit(`event:${message.event.eventType}`, message.event);
        break;

      case 'presence_update':
        this._presence = message.presence;
        this.emit('presence', this._presence);
        break;

      case 'error':
        this.emit('error', { code: message.code, message: message.message });
        break;

      case 'pong':
        // Heartbeat acknowledged
        break;
    }
  }

  private handleDisconnect(): void {
    this.cleanup();

    if (this.config.reconnect.enabled && this.reconnectAttempt < this.config.reconnect.maxAttempts) {
      this._status = 'reconnecting';
      this.emit('status', this._status);
      this.scheduleReconnect();
    } else {
      this._status = 'error';
      this.emit('status', this._status);
      this.emit('error', new Error('Connection lost and max reconnect attempts reached'));
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.config.reconnect.baseDelayMs * Math.pow(2, this.reconnectAttempt),
      this.config.reconnect.maxDelayMs
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempt++;
      this.establishConnection().catch(() => {
        this.handleDisconnect();
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendMessage({ type: 'ping' });
    }, this.config.heartbeatIntervalMs);
  }

  private resetActivityTimeout(): void {
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }

    this.activityTimeout = setTimeout(() => {
      this.emit('idle', true);
    }, this.config.activityTimeoutMs);
  }

  private sendMessage(message: ClientMessage): void {
    // For SSE, we need to send messages via HTTP POST
    if (!this.subscriptionId) return;

    fetch(`${this.config.baseUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: this.subscriptionId,
        message,
      }),
    }).catch((error) => {
      console.error('[realtime-client] Failed to send message:', error);
    });
  }

  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
      this.activityTimeout = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: RealtimeClient | null = null;

export function getRealtimeClient(config?: RealtimeClientConfig): RealtimeClient {
  if (!clientInstance) {
    clientInstance = new RealtimeClient(config);
  }
  return clientInstance;
}

// ============================================================================
// React Hook Utilities (for use in components)
// ============================================================================

/**
 * Field highlight state for real-time updates
 */
export interface FieldHighlight {
  path: string;
  type: 'updated' | 'locked' | 'editing';
  userId?: string;
  userName?: string;
  expiresAt: number;
}

/**
 * Create field highlight from event
 */
export function createFieldHighlight(event: RealtimeEvent, durationMs = 3000): FieldHighlight | null {
  const expiresAt = Date.now() + durationMs;

  switch (event.eventType) {
    case 'field_updated':
      return {
        path: event.path,
        type: 'updated',
        userId: event.userId,
        userName: event.userName,
        expiresAt,
      };

    case 'field_locked':
      return {
        path: event.path,
        type: 'locked',
        expiresAt,
      };

    case 'user_editing_started':
      return {
        path: event.selectedPath || '',
        type: 'editing',
        userId: event.userId,
        userName: event.userName,
        expiresAt: Date.now() + 60000, // Editing highlights last longer
      };

    default:
      return null;
  }
}
