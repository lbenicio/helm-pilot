import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'OK', uptime: process.uptime(), timestamp: new Date().toISOString() });
}
