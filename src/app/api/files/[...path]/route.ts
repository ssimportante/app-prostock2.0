import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, validateCsrfToken } from '@/lib/auth-server';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filename = path.join('/');
  const filepath = join(process.cwd(), 'uploads', filename);

  try {
    const buffer = await readFile(filepath);
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await validateCsrfToken(req))) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const { path } = await params;
  const filename = path.join('/');
  const filepath = join(process.cwd(), 'uploads', filename);

  try {
    await unlink(filepath);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
