import { NextResponse } from 'next/server';
import { qboClient } from '@/lib/qbo';

import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const includeInactive = searchParams.get('all') === 'true';
        const companies = await qboClient.getConnectedCompanies(supabase, includeInactive);
        return NextResponse.json(companies);
    } catch (error) {
        console.error('Error fetching connected companies:', error);
        return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
    }
}
