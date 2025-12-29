// app/api/context/collaboration/route.ts
// Multi-user collaboration API
//
// Phase 4: Presence tracking and conflict resolution

import { NextRequest, NextResponse } from 'next/server';
import {
  addUserPresence,
  removeUserPresence,
  updateUserFocus,
  getCompanyUsers,
  getDomainViewers,
  getPathEditor,
  acquireEditLock,
  releaseEditLock,
  extendEditLock,
  isPathLocked,
  getPendingConflicts,
  resolveConflict,
  generateMergeSuggestion,
  updateActivityStatus,
  cleanupExpired,
  getCollaborationStats,
} from '@/lib/contextGraph/collaboration';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

export const runtime = 'nodejs';

/**
 * GET /api/context/collaboration
 *
 * Query collaboration state.
 *
 * Query params:
 * - companyId: Company ID (required)
 * - mode: 'users' | 'domain_viewers' | 'path_editor' | 'lock_status' | 'conflicts' | 'stats'
 * - domain: Domain name (for domain_viewers)
 * - path: Field path (for path_editor and lock_status)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const mode = searchParams.get('mode') || 'users';
    const domain = searchParams.get('domain') as DomainName | null;
    const path = searchParams.get('path');

    if (!companyId && mode !== 'stats') {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Update activity status periodically
    updateActivityStatus();

    let result: Record<string, unknown>;

    switch (mode) {
      case 'users': {
        const users = getCompanyUsers(companyId!);
        result = {
          users: users.map(u => ({
            userId: u.userId,
            userName: u.userName,
            userColor: u.userColor,
            status: u.status,
            selectedDomain: u.selectedDomain,
            selectedPath: u.selectedPath,
            isEditing: u.isEditing,
            editingPath: u.editingPath,
            lastActivityAt: u.lastActivityAt,
          })),
          count: users.length,
        };
        break;
      }

      case 'domain_viewers': {
        if (!domain) {
          return NextResponse.json(
            { error: 'domain is required for domain_viewers mode' },
            { status: 400 }
          );
        }
        const viewers = getDomainViewers(companyId!, domain);
        result = {
          viewers: viewers.map(u => ({
            userId: u.userId,
            userName: u.userName,
            userColor: u.userColor,
            status: u.status,
          })),
          count: viewers.length,
        };
        break;
      }

      case 'path_editor': {
        if (!path) {
          return NextResponse.json(
            { error: 'path is required for path_editor mode' },
            { status: 400 }
          );
        }
        const editor = getPathEditor(companyId!, path);
        result = {
          editor: editor ? {
            userId: editor.userId,
            userName: editor.userName,
            userColor: editor.userColor,
            editStartedAt: editor.editStartedAt,
          } : null,
        };
        break;
      }

      case 'lock_status': {
        if (!path) {
          return NextResponse.json(
            { error: 'path is required for lock_status mode' },
            { status: 400 }
          );
        }
        const lockStatus = isPathLocked(companyId!, path);
        result = {
          locked: lockStatus.locked,
          lock: lockStatus.lock ? {
            lockedBy: lockStatus.lock.lockedBy,
            lockedByName: lockStatus.lock.lockedByName,
            lockedAt: lockStatus.lock.lockedAt,
            expiresAt: lockStatus.lock.expiresAt,
          } : null,
        };
        break;
      }

      case 'conflicts': {
        const conflicts = getPendingConflicts(companyId!);
        result = {
          conflicts,
          count: conflicts.length,
        };
        break;
      }

      case 'stats': {
        const stats = getCollaborationStats();
        result = { stats };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Invalid mode: ${mode}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ...result,
      mode,
      companyId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[collaboration] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/context/collaboration
 *
 * Perform collaboration actions.
 *
 * Body:
 * - companyId: Company ID
 * - action: 'join' | 'leave' | 'focus' | 'lock' | 'unlock' | 'extend_lock' | 'resolve_conflict' | 'cleanup'
 * - userId: User ID (for join)
 * - userName: User name (for join)
 * - sessionId: Session ID (for leave, focus, lock actions)
 * - domain: Domain name (for focus)
 * - path: Field path (for focus, lock actions)
 * - conflictId: Conflict ID (for resolve_conflict)
 * - winningValue: Value to use (for resolve_conflict)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      action,
      userId,
      userName,
      userAvatar,
      sessionId,
      domain,
      path,
      conflictId,
      winningValue,
    } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    let result: Record<string, unknown>;

    switch (action) {
      case 'join': {
        if (!companyId || !userId || !userName) {
          return NextResponse.json(
            { error: 'companyId, userId, and userName are required' },
            { status: 400 }
          );
        }
        const presence = addUserPresence(companyId, userId, userName, userAvatar);
        result = {
          joined: true,
          sessionId: presence.sessionId,
          userColor: presence.userColor,
        };
        break;
      }

      case 'leave': {
        if (!companyId || !sessionId) {
          return NextResponse.json(
            { error: 'companyId and sessionId are required' },
            { status: 400 }
          );
        }
        const left = removeUserPresence(companyId, sessionId);
        result = { left };
        break;
      }

      case 'focus': {
        if (!companyId || !sessionId) {
          return NextResponse.json(
            { error: 'companyId and sessionId are required' },
            { status: 400 }
          );
        }
        updateUserFocus(
          companyId,
          sessionId,
          domain as DomainName | undefined,
          path || undefined
        );
        result = { focused: true };
        break;
      }

      case 'lock': {
        if (!companyId || !sessionId || !path) {
          return NextResponse.json(
            { error: 'companyId, sessionId, and path are required' },
            { status: 400 }
          );
        }
        const lockResult = acquireEditLock(companyId, sessionId, path);
        result = {
          locked: lockResult.success,
          lock: lockResult.lock,
          existingLock: lockResult.existingLock,
        };
        break;
      }

      case 'unlock': {
        if (!path || !sessionId) {
          return NextResponse.json(
            { error: 'path and sessionId are required' },
            { status: 400 }
          );
        }
        const unlocked = releaseEditLock(path, sessionId);
        result = { unlocked };
        break;
      }

      case 'extend_lock': {
        if (!path || !sessionId) {
          return NextResponse.json(
            { error: 'path and sessionId are required' },
            { status: 400 }
          );
        }
        const extended = extendEditLock(path, sessionId);
        result = { extended };
        break;
      }

      case 'resolve_conflict': {
        if (!conflictId || !userId || winningValue === undefined) {
          return NextResponse.json(
            { error: 'conflictId, userId, and winningValue are required' },
            { status: 400 }
          );
        }
        const resolved = resolveConflict(conflictId, userId, winningValue);
        result = { resolved };
        break;
      }

      case 'get_merge_suggestion': {
        if (!conflictId) {
          return NextResponse.json(
            { error: 'conflictId is required' },
            { status: 400 }
          );
        }
        const conflicts = getPendingConflicts(companyId || '');
        const conflict = conflicts.find(c => c.id === conflictId);
        if (!conflict) {
          return NextResponse.json(
            { error: 'Conflict not found' },
            { status: 404 }
          );
        }
        const suggestion = generateMergeSuggestion(conflict);
        result = { suggestion };
        break;
      }

      case 'cleanup': {
        const cleanupResult = cleanupExpired();
        result = {
          cleaned: true,
          locksRemoved: cleanupResult.locksRemoved,
          conflictsExpired: cleanupResult.conflictsExpired,
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ...result,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[collaboration] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
