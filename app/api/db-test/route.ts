import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Test basic database connection
    const result = await sql`SELECT NOW() as current_time`;
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      timestamp: result.rows[0]?.current_time,
      postgres_url_configured: !!process.env.POSTGRES_URL
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      postgres_url_configured: !!process.env.POSTGRES_URL
    }, { status: 500 });
  }
}