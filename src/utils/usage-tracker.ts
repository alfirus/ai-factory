export interface UsageRecord {
  provider: string;
  model: string;
  tool: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface ProviderUsageSummary {
  provider: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  lastUsed: number | null;
  models: Record<string, number>;
}

class UsageTracker {
  private records: UsageRecord[] = [];
  private startTime = Date.now();

  record(entry: UsageRecord): void {
    this.records.push(entry);
  }

  async track<T>(
    provider: string,
    model: string,
    tool: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.record({
        provider,
        model,
        tool,
        timestamp: start,
        durationMs: Date.now() - start,
        success: true,
      });
      return result;
    } catch (error) {
      this.record({
        provider,
        model,
        tool,
        timestamp: start,
        durationMs: Date.now() - start,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getSummary(): {
    uptime: number;
    totalRequests: number;
    providers: ProviderUsageSummary[];
    recentErrors: UsageRecord[];
  } {
    const byProvider = new Map<string, UsageRecord[]>();

    for (const r of this.records) {
      const list = byProvider.get(r.provider) || [];
      list.push(r);
      byProvider.set(r.provider, list);
    }

    const providers: ProviderUsageSummary[] = [];
    for (const [name, records] of byProvider) {
      const successRecords = records.filter((r) => r.success);
      const errorRecords = records.filter((r) => !r.success);
      const models: Record<string, number> = {};
      for (const r of records) {
        models[r.model] = (models[r.model] || 0) + 1;
      }
      const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0);

      providers.push({
        provider: name,
        totalRequests: records.length,
        successCount: successRecords.length,
        errorCount: errorRecords.length,
        avgDurationMs: records.length > 0 ? Math.round(totalDuration / records.length) : 0,
        lastUsed: records.length > 0 ? records[records.length - 1].timestamp : null,
        models,
      });
    }

    const recentErrors = this.records
      .filter((r) => !r.success)
      .slice(-10);

    return {
      uptime: Date.now() - this.startTime,
      totalRequests: this.records.length,
      providers,
      recentErrors,
    };
  }

  getRecords(): UsageRecord[] {
    return [...this.records];
  }
}

export const usageTracker = new UsageTracker();
