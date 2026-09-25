import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { buildSummary } from '@/server/reports';

export async function GET() {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({ summary: buildSummary(getDb()) });
}
