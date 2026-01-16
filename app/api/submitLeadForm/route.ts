import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { NextResponse } from 'next/server';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await convex.action(api.leads.actions.submitLeadForm, {
      name: body.name,
      phone: body.phone,
      email: body.email,
      property_address: body.property_address,
      timeline: body.timeline,
      form_id: body.form_id,
      source: body.source,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error submitting lead form:', error);
    return NextResponse.json(
      { error: 'Failed to submit form' },
      { status: 500 }
    );
  }
}
