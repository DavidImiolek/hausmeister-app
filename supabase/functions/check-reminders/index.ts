import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push
const VAPID_PUBLIC = 'BMpxXzyd60vSRnykfxLwLKZwfZwXKDSUIfZmtCOu2wNsG8GUz4_lrbsBZJ5x1Aio-LkrHZm-Z65b7JDb8fwGdMc';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = 'mailto:david.imiolek@gmx.de';

async function sendPush(subscription: any, payload: string) {
  // Use web-push compatible crypto
  const { default: webpush } = await import("https://esm.sh/web-push@3.6.7");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  await webpush.sendNotification(subscription, payload);
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Tomorrow in German timezone
    const now = new Date();
    const berlinOffset = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const tomorrow = new Date(berlinOffset);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Get tomorrow's visits with customer names
    const { data: visits, error } = await supabase
      .from('visits')
      .select('*, customers(name)')
      .eq('date', dateStr);

    if (error) return new Response(JSON.stringify({ error }), { status: 500 });
    if (!visits?.length) return new Response(JSON.stringify({ msg: 'Keine Termine morgen' }));

    // Build notification text
    const list = visits.map((v: any) =>
      `• ${v.customers?.name || 'Unbekannt'} (${v.duration_minutes} Min.)`
    ).join('\n');

    const payload = JSON.stringify({
      title: `📅 Morgen: ${visits.length} Termin${visits.length > 1 ? 'e' : ''}`,
      body: list
    });

    // Get all push subscriptions
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription');

    if (!subs?.length) return new Response(JSON.stringify({ msg: 'Keine Subscriptions' }));

    let sent = 0;
    for (const s of subs) {
      try {
        await sendPush(s.subscription, payload);
        sent++;
      } catch (e: any) {
        console.error('Push failed:', e.message);
        // Remove invalid subscriptions (410 Gone)
        if (e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('subscription', s.subscription);
        }
      }
    }

    return new Response(JSON.stringify({ sent, total: visits.length }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
