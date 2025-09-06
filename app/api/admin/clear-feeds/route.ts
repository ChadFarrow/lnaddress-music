import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function DELETE() {
  try {
    // Clear all feeds from database
    const result = await sql`DELETE FROM feeds`;
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${result.rowCount || 0} feeds from database`
    });
  } catch (error) {
    console.error('Error clearing feeds:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}