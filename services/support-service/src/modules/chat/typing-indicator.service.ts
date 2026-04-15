import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';

/**
 * TypingIndicatorService — Redis-backed typing state with a 3s
 * TTL that auto-expires if the client goes dark mid-type.
 *
 * State shape: for every (ticketId, userId) pair we keep a single
 * Redis key `support:typing:{ticketId}:{userId}` → `${name}` with
 * a 3-second TTL. Every `typing:start` refreshes the TTL (so the
 * status stays alive as long as the client keeps hitting it at
 * typical keystroke cadence), and `typing:stop` / a dead socket
 * / a 3s silence all drop the key automatically.
 *
 * The gateway reads the full set of active typers on a ticket by
 * scanning the prefix with SCAN (small cardinality — 1 open
 * ticket rarely has more than 3-4 concurrent typers), and emits
 * the list as a `user:typing` event.
 *
 * All Redis calls go through the tolerant `redis.run()` helper so
 * a missing Redis in dev degrades to "no typing indicators" rather
 * than crashing the gateway — matches the fail-soft pattern
 * elsewhere in the service.
 */
@Injectable()
export class TypingIndicatorService {
  private readonly logger = new Logger(TypingIndicatorService.name);

  /** TTL on a typing key — long enough for normal typing cadence,
   *  short enough that a frozen window clears quickly. */
  private static readonly TTL_SECONDS = 3;

  constructor(private readonly redis: RedisService) {}

  // -------------------------------------------------------------------
  // Key builders
  // -------------------------------------------------------------------

  /** Redis key for one user's typing state on one ticket. */
  private key(ticketId: string, userId: string): string {
    return `support:typing:${ticketId}:${userId}`;
  }

  /** Wildcard pattern for all typers on one ticket — used by
   *  `currentTypers()` to enumerate. */
  private pattern(ticketId: string): string {
    return `support:typing:${ticketId}:*`;
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  /**
   * Mark a user as currently typing on a ticket. Idempotent — if
   * the user was already typing, the TTL is simply refreshed.
   * The stored value is the display name so readers don't have
   * to re-fetch the user row from Postgres.
   */
  async startTyping(
    ticketId: string,
    userId: string,
    displayName: string,
  ): Promise<void> {
    await this.redis.setWithTTL(
      this.key(ticketId, userId),
      displayName,
      TypingIndicatorService.TTL_SECONDS,
    );
  }

  /**
   * Explicitly clear a user's typing state. Normally called on
   * `typing:stop` or socket disconnect. No-op if no state exists.
   */
  async stopTyping(ticketId: string, userId: string): Promise<void> {
    await this.redis.del(this.key(ticketId, userId));
  }

  /**
   * Return every user currently typing on a ticket, minus the
   * `excludeUserId` (always the caller — a user never sees their
   * own typing indicator). Returns a list of `{ userId, name }`.
   *
   * Implementation: SCAN the pattern in one pass, then MGET the
   * values. On a typical support ticket this is 0-4 keys so the
   * round-trip cost is negligible; no need to pipeline.
   */
  async currentTypers(
    ticketId: string,
    excludeUserId?: string,
  ): Promise<Array<{ userId: string; name: string }>> {
    const entries = await this.redis.scanKeys(this.pattern(ticketId));
    if (entries.length === 0) return [];

    const results: Array<{ userId: string; name: string }> = [];
    for (const key of entries) {
      const userId = key.slice(`support:typing:${ticketId}:`.length);
      if (excludeUserId && userId === excludeUserId) continue;
      const name = await this.redis.get(key);
      if (name) results.push({ userId, name });
    }
    return results;
  }

  /**
   * Clean up every typing key for a user across every ticket. Called
   * on socket disconnect — without this, a user who was typing on
   * several tickets when their laptop went to sleep would leave
   * lingering (though TTL'd) state behind for up to 3 seconds.
   */
  async clearUserEverywhere(userId: string): Promise<void> {
    const keys = await this.redis.scanKeys(`support:typing:*:${userId}`);
    for (const key of keys) {
      await this.redis.del(key);
    }
  }
}
