import { NextResponse } from 'next/server';
import { getSpuStatistics } from '@/app/actions/poizon';

export async function GET() {
  try {
    const spuId = 19498274; // JKJJS25122
    const statsRes = await getSpuStatistics([spuId]);

    return NextResponse.json({
       statsRes: statsRes
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
