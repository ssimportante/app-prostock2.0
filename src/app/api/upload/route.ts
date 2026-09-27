import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, validateCsrfToken } from '@/lib/auth-server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await validateCsrfToken(req))) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filepath = join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    return NextResponse.json({ url: `/api/files/${filename}` });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also support base64 string uploads (for uploadString compatibility)
export async function PUT(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await validateCsrfToken(req))) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  try {
    const { data: dataUrl, filename: customName } = await req.json();
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid data URL' }, { status: 400 });
    }

    const ext = matches[1].split('/')[1] || 'jpg';
    const filename = customName || `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filepath = join(uploadDir, filename);
    const buffer = Buffer.from(matches[2], 'base64');
    await writeFile(filepath, buffer);

    return NextResponse.json({ url: `/api/files/${filename}` });
  } catch (error: any) {
    console.error('Upload (PUT) error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
