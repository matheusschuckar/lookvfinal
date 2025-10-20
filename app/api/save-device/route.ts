export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { apnsToken, userId } = await req.json();

  if (!apnsToken) {
    return NextResponse.json({ ok: false, error: 'missing apnsToken' }, { status: 400 });
  }

  const url = `${process.env.SUPABASE_URL}/rest/v1/devices`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      apns_token: apnsToken,
      user_id: userId ?? null,
      platform: 'ios',
      updated_at: new Date().toISOString()
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    return NextResponse.json({ ok: false, error: t }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
