

import * as crypto from 'crypto';

export interface CacheEntry {
    fix: string;
    timestamp: number;
    success: boolean;
}

export class FixCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly TTL = 1000 * 60 * 60;

    private createKey(code: string, error: string): string {
        return crypto.createHash('md5').update(`${code}:${error}`).digest('hex');
    }

    set(code: string, error: string, fix: string, success: boolean): void {
        const key = this.createKey(code, error);
        this.cache.set(key, { fix, timestamp: Date.now(), success });
    }

    get(code: string, error: string): CacheEntry | undefined {
        const key = this.createKey(code, error);
        const entry = this.cache.get(key);
        if (!entry || Date.now() - entry.timestamp > this.TTL) {
            this.cache.delete(key);
            return undefined;
        }
        return entry;
    }
}