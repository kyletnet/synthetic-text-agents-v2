# Trust Console Implementation Guide (P3)

**Status**: ⏳ Design Complete, Implementation Pending
**Estimated Effort**: 3-4 days
**Prerequisites**: P0-P2-3 Complete ✅
**Target**: Visible Trust (Customer-facing UI)

---

## Overview

Trust Console은 **"Proven Trust → Visible Trust"** 전환을 위한 고객 접점 인터페이스입니다.

**목적**:
- 고객이 AI 결정의 신뢰 근거를 **눈으로 확인**
- 실시간 trust score, evidence, compliance 상태 표시
- Approve/Rollback/Explain 등 **통제 가능한 액션** 제공
- 투자자/규제기관 데모용 **시각적 증거**

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Next.js 14 App Router)               │
│  ├─ /app/trust/page.tsx (SSR)                  │
│  └─ /app/trust/components/                     │
│      ├─ TrustBadge.tsx                         │
│      ├─ EvidenceViewer.tsx                     │
│      ├─ ComplianceBadge.tsx                    │
│      ├─ ActionButtons.tsx                      │
│      └─ AuditTimeline.tsx                      │
├─────────────────────────────────────────────────┤
│  API Layer (Next.js API Routes)                 │
│  └─ /app/api/trust/                            │
│      ├─ route.ts (GET /api/trust)              │
│      ├─ evidence/route.ts                      │
│      ├─ compliance/route.ts                    │
│      ├─ telemetry/route.ts                     │
│      └─ snapshot/route.ts                      │
├─────────────────────────────────────────────────┤
│  Trust Infrastructure (P0-P2-3) ✅              │
│  ├─ TrustToken (P0)                            │
│  ├─ EvidenceStore (P1)                         │
│  ├─ TelemetryInterpreter (P2-1)                │
│  ├─ Gate E (P2-2)                              │
│  └─ SnapshotLogger (P2-3)                      │
└─────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: API Layer (1 day)

#### 1.1 Main Trust API
**File**: `apps/fe-web/app/api/trust/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getEvidenceStore } from '@/core/transparency';
import { createTrustTokenGenerator } from '@/core/trust';
import { createTelemetryInterpreter } from '@/core/telemetry';
import { createSnapshotLogger } from '@/core/trust';

export async function GET(request: Request) {
  try {
    // 1. Get latest snapshot
    const logger = createSnapshotLogger();
    const snapshotPath = getLatestSnapshotPath();
    const snapshotResult = logger.loadSnapshot(snapshotPath);

    if (!snapshotResult.valid) {
      return NextResponse.json({ error: 'Invalid snapshot' }, { status: 500 });
    }

    const snapshot = snapshotResult.snapshot;

    // 2. Get evidence statistics
    const store = getEvidenceStore();
    const evidenceStats = store.getStats();

    // 3. Generate TrustToken
    const generator = createTrustTokenGenerator();
    const token = await generator.generate(
      JSON.stringify(snapshot),
      snapshot.trustScore,
      {
        sourceIds: [], // Get from evidence store
        trustScores: [],
        retrievalStrategy: 'bm25'
      },
      snapshot.complianceStatus,
      { tenantId: request.headers.get('x-tenant-id') || 'default' }
    );

    return NextResponse.json({
      trustToken: token,
      trustScore: snapshot.trustScore,
      evidenceStats,
      compliance: snapshot.complianceStatus,
      telemetry: snapshot.telemetrySummary,
      snapshotId: snapshot.id,
      timestamp: snapshot.timestamp
    });
  } catch (error) {
    console.error('[Trust API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trust data' },
      { status: 500 }
    );
  }
}

function getLatestSnapshotPath(): string {
  // Implement: Find latest snapshot file in reports/trust-snapshots/
  const fs = require('fs');
  const path = require('path');
  const dir = 'reports/trust-snapshots';
  const files = fs.readdirSync(dir).sort().reverse();
  return path.join(dir, files[0]);
}
```

#### 1.2 Evidence API
**File**: `apps/fe-web/app/api/trust/evidence/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getEvidenceStore } from '@/core/transparency';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const evidenceId = searchParams.get('id');
  const minTrustScore = parseFloat(searchParams.get('minTrustScore') || '0');
  const limit = parseInt(searchParams.get('limit') || '10');

  const store = getEvidenceStore();

  if (evidenceId) {
    // Single evidence lookup
    const evidence = store.getEvidence(evidenceId);
    return NextResponse.json({ evidence });
  }

  // Query evidence
  const evidence = store.queryEvidence({
    minTrustScore,
    limit
  });

  return NextResponse.json({ evidence, total: evidence.length });
}
```

#### 1.3 Compliance API
**File**: `apps/fe-web/app/api/trust/compliance/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createSnapshotLogger } from '@/core/trust';

export async function GET() {
  const logger = createSnapshotLogger();
  const snapshotPath = getLatestSnapshotPath();
  const result = logger.loadSnapshot(snapshotPath);

  if (!result.valid) {
    return NextResponse.json({ error: 'Invalid snapshot' }, { status: 500 });
  }

  return NextResponse.json({
    compliance: result.snapshot.complianceStatus,
    lastAuditDate: result.snapshot.complianceStatus.lastAuditDate,
    snapshotIntegrity: result.checksumMatch
  });
}
```

#### 1.4 Telemetry API
**File**: `apps/fe-web/app/api/trust/telemetry/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createTelemetryInterpreter } from '@/core/telemetry';

export async function POST(request: Request) {
  const { events } = await request.json();

  const interpreter = createTelemetryInterpreter();
  const insight = interpreter.interpret(events);

  // Store insight for analytics (optional)
  // saveInsightToAnalytics(insight);

  return NextResponse.json({ insight });
}
```

#### 1.5 Snapshot API
**File**: `apps/fe-web/app/api/trust/snapshot/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createSnapshotLogger } from '@/core/trust';

export async function GET() {
  const logger = createSnapshotLogger();
  const snapshotPath = getLatestSnapshotPath();
  const result = logger.loadSnapshot(snapshotPath);

  return NextResponse.json({
    snapshot: result.snapshot,
    valid: result.valid,
    checksumMatch: result.checksumMatch,
    error: result.error
  });
}
```

---

### Phase 2: UI Components (2 days)

#### 2.1 Trust Badge
**File**: `apps/fe-web/app/trust/components/TrustBadge.tsx`

```typescript
'use client';

import { Badge } from '@/components/ui/badge';

interface TrustBadgeProps {
  groundedness: number;
  alignment: number;
  faithfulness: number;
  overall: number;
}

export function TrustBadge({ groundedness, alignment, faithfulness, overall }: TrustBadgeProps) {
  const getColor = (score: number) => {
    if (score >= 0.85) return 'bg-green-500';
    if (score >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg">
      <h3 className="font-semibold">Trust Score</h3>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${getColor(overall)}`} />
        <span className="text-2xl font-bold">{(overall * 100).toFixed(1)}%</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
        <div>
          <div className="text-muted-foreground">Groundedness</div>
          <div className="font-medium">{(groundedness * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">Alignment</div>
          <div className="font-medium">{(alignment * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">Faithfulness</div>
          <div className="font-medium">{(faithfulness * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}
```

#### 2.2 Evidence Viewer
**File**: `apps/fe-web/app/trust/components/EvidenceViewer.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Evidence {
  id: string;
  sourceId: string;
  content: string;
  trustScore: number;
  metadata: {
    domain?: string;
    retrievalStrategy: string;
  };
}

interface EvidenceViewerProps {
  evidence: Evidence[];
}

export function EvidenceViewer({ evidence }: EvidenceViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = evidence.find((e) => e.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">Evidence Sources</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {evidence.map((item) => (
            <Button
              key={item.id}
              variant={selectedId === item.id ? 'default' : 'outline'}
              onClick={() => setSelectedId(item.id)}
              className="w-full justify-start"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{item.sourceId}</span>
                <span className="text-xs text-muted-foreground">
                  Trust: {(item.trustScore * 100).toFixed(0)}%
                </span>
              </div>
            </Button>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          {selected ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Source: {selected.sourceId}</div>
              <div className="text-sm text-muted-foreground">
                Trust Score: {(selected.trustScore * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">
                Strategy: {selected.metadata.retrievalStrategy}
              </div>
              {selected.metadata.domain && (
                <div className="text-sm text-muted-foreground">
                  Domain: {selected.metadata.domain}
                </div>
              )}
              <div className="mt-4 text-sm">{selected.content}</div>
            </div>
          ) : (
            <div className="text-muted-foreground">Select an evidence source to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 2.3 Compliance Badge
**File**: `apps/fe-web/app/trust/components/ComplianceBadge.tsx`

```typescript
'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ComplianceBadgeProps {
  gdpr: boolean;
  ccpa: boolean;
  hipaa: boolean;
  lastAuditDate?: string;
}

export function ComplianceBadge({ gdpr, ccpa, hipaa, lastAuditDate }: ComplianceBadgeProps) {
  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg">
      <h3 className="font-semibold">Compliance Status</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span>GDPR</span>
          {gdpr ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Compliant
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="w-3 h-3" />
              Non-compliant
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span>CCPA</span>
          {ccpa ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Compliant
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="w-3 h-3" />
              Non-compliant
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span>HIPAA</span>
          {hipaa ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Compliant
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              N/A
            </Badge>
          )}
        </div>
      </div>
      {lastAuditDate && (
        <div className="mt-2 text-xs text-muted-foreground">
          Last audit: {new Date(lastAuditDate).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
```

#### 2.4 Action Buttons
**File**: `apps/fe-web/app/trust/components/ActionButtons.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface ActionButtonsProps {
  onApprove: () => void;
  onRollback: () => void;
  onExplain: () => void;
}

export function ActionButtons({ onApprove, onRollback, onExplain }: ActionButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button onClick={onApprove} variant="default" className="gap-2">
        <CheckCircle className="w-4 h-4" />
        Approve
      </Button>
      <Button onClick={onRollback} variant="destructive" className="gap-2">
        <XCircle className="w-4 h-4" />
        Rollback
      </Button>
      <Button onClick={onExplain} variant="outline" className="gap-2">
        <Info className="w-4 h-4" />
        Explain
      </Button>
    </div>
  );
}
```

#### 2.5 Audit Timeline
**File**: `apps/fe-web/app/trust/components/AuditTimeline.tsx`

```typescript
'use client';

import { Badge } from '@/components/ui/badge';

interface AuditEvent {
  id: string;
  type: 'policy_change' | 'decision' | 'feedback' | 'rollback';
  timestamp: Date;
  description: string;
  actor: 'system' | 'human' | 'policy';
}

interface AuditTimelineProps {
  events: AuditEvent[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  const getTypeColor = (type: AuditEvent['type']) => {
    switch (type) {
      case 'policy_change': return 'bg-blue-500';
      case 'decision': return 'bg-green-500';
      case 'feedback': return 'bg-yellow-500';
      case 'rollback': return 'bg-red-500';
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg">
      <h3 className="font-semibold">Audit Timeline</h3>
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${getTypeColor(event.type)}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{event.description}</span>
                <Badge variant="outline">{event.actor}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {event.timestamp.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Phase 3: Main Page (0.5 day)

**File**: `apps/fe-web/app/trust/page.tsx`

```typescript
import { TrustBadge } from './components/TrustBadge';
import { EvidenceViewer } from './components/EvidenceViewer';
import { ComplianceBadge } from './components/ComplianceBadge';
import { ActionButtons } from './components/ActionButtons';
import { AuditTimeline } from './components/AuditTimeline';

export default async function TrustConsolePage() {
  // Fetch trust data (SSR)
  const response = await fetch('http://localhost:3001/api/trust', {
    cache: 'no-store'
  });
  const data = await response.json();

  // Fetch evidence
  const evidenceResponse = await fetch('http://localhost:3001/api/trust/evidence?limit=10', {
    cache: 'no-store'
  });
  const evidenceData = await evidenceResponse.json();

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trust Console</h1>
        <div className="text-sm text-muted-foreground">
          Snapshot: {new Date(data.timestamp).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TrustBadge
          groundedness={data.trustScore.groundedness}
          alignment={data.trustScore.alignment}
          faithfulness={data.trustScore.faithfulness}
          overall={data.trustScore.overall}
        />
        <ComplianceBadge
          gdpr={data.compliance.gdpr}
          ccpa={data.compliance.ccpa}
          hipaa={data.compliance.hipaa}
          lastAuditDate={data.compliance.lastAuditDate}
        />
      </div>

      <EvidenceViewer evidence={evidenceData.evidence} />

      <ActionButtons
        onApprove={() => console.log('Approve')}
        onRollback={() => console.log('Rollback')}
        onExplain={() => console.log('Explain')}
      />

      <AuditTimeline events={[]} />
    </div>
  );
}
```

---

### Phase 4: Integration & Testing (0.5 day)

#### 4.1 Integration Tests
```typescript
// tests/integration/trust-console.test.ts
describe('Trust Console Integration', () => {
  it('should fetch trust data from API', async () => {
    const response = await fetch('/api/trust');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.trustToken).toBeDefined();
    expect(data.trustScore).toBeDefined();
  });

  it('should display trust badge with correct scores', () => {
    // Implement UI test
  });

  it('should track telemetry events', async () => {
    const events = [{ type: 'click', target: 'trust-badge', ... }];
    const response = await fetch('/api/trust/telemetry', {
      method: 'POST',
      body: JSON.stringify({ events })
    });
    expect(response.status).toBe(200);
  });
});
```

#### 4.2 E2E Tests
```typescript
// e2e/trust-console.spec.ts
import { test, expect } from '@playwright/test';

test('Trust Console full flow', async ({ page }) => {
  await page.goto('http://localhost:3001/trust');

  // Check trust badge
  await expect(page.locator('text=Trust Score')).toBeVisible();

  // Check evidence viewer
  await expect(page.locator('text=Evidence Sources')).toBeVisible();

  // Click evidence
  await page.click('button:has-text("chunk-1")');
  await expect(page.locator('text=Source: chunk-1')).toBeVisible();

  // Check compliance
  await expect(page.locator('text=GDPR')).toBeVisible();
  await expect(page.locator('text=Compliant')).toBeVisible();
});
```

---

## KPI Targets

| KPI | Target | Measurement |
|-----|--------|-------------|
| SSR Latency | ≤3s | Lighthouse performance |
| Evidence-UI Match | ≥90% | Cross-validation test |
| Telemetry Capture | ≥95% | Event tracking coverage |
| Lighthouse Score | ≥90 | Lighthouse CI |
| Snapshot Integrity | 100% | Checksum verification |

---

## Deployment Checklist

- [ ] API routes tested (`npm test`)
- [ ] UI components tested (Storybook or manual)
- [ ] Integration tests passing
- [ ] E2E tests passing (Playwright)
- [ ] Lighthouse score ≥90
- [ ] SSR latency ≤3s
- [ ] TrustToken in all API responses
- [ ] Telemetry tracking enabled
- [ ] Snapshot logger triggered on page load
- [ ] Documentation updated

---

## Troubleshooting

### Issue: API returns 500 error
```bash
# Check if snapshot exists
ls reports/trust-snapshots/

# Verify snapshot integrity
node -e "const logger = require('./src/core/trust/snapshot-logger'); const result = logger.loadSnapshot('path'); console.log(result);"
```

### Issue: UI not showing trust data
```bash
# Check API response
curl http://localhost:3001/api/trust

# Check browser console for errors
# Verify fetch URL matches server port
```

### Issue: Telemetry not capturing events
```typescript
// Ensure telemetry hook is attached
useEffect(() => {
  const handleClick = (e) => {
    trackTelemetryEvent({ type: 'click', target: e.target.id, ... });
  };
  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}, []);
```

---

## References

- **Prerequisites**: `docs/TRUST_INFRASTRUCTURE.md`
- **Next.js 14 Docs**: https://nextjs.org/docs
- **Radix UI**: https://www.radix-ui.com/
- **Tailwind CSS**: https://tailwindcss.com/

---

**Document Version**: 1.0
**Last Updated**: 2025-10-08
**Status**: Ready for Implementation
