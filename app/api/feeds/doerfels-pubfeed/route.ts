import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Return empty RSS feed since we're removing all RSS content
  const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Empty Feed</title>
    <description>This feed has been cleared</description>
    <link>https://example.com</link>
  </channel>
</rss>`;

  return new NextResponse(emptyFeed, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Access-Control-Allow-Origin': '*',
    },
  });
}