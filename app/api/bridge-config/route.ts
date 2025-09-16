import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const bridgeConnection = process.env.ALBY_HUB_BRIDGE_NWC || '';
    const isConfigured = !!bridgeConnection && !bridgeConnection.includes('YOUR_');
    
    return NextResponse.json({
      isConfigured,
      // Only return the connection string if it's configured properly
      // (we send it to client, but it's still in your environment)
      connection: isConfigured ? bridgeConnection : null
    });
  } catch (error) {
    console.error('Bridge config API error:', error);
    return NextResponse.json({
      isConfigured: false,
      connection: null
    });
  }
}