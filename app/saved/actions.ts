'use server';
import { z } from 'zod';
import { sb } from '@/lib/supabase';

export type SaveResult = { ok: true; saved: boolean } | { ok: false; auth?: boolean; message: string };

// Heart button: saves the product if it is not saved yet, otherwise removes it. Runs as the signed-in customer,
// so row level security guarantees nobody can touch another person's saved items.
export async function toggleSaved(productId: string): Promise<SaveResult> {
  const id = z.string().uuid().safeParse(productId);
  if (!id.success) return { ok: false, message: 'That product could not be saved.' };
  const s = sb();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return { ok: false, auth: true, message: 'Please sign in to save items.' };

  const { data: existing, error: readErr } = await s.from('saved_items').select('product_id').eq('user_id', user.id).eq('product_id', id.data).maybeSingle();
  if (readErr) return { ok: false, message: 'Saved items are not available right now. Please try again later.' };

  if (existing) {
    const { error } = await s.from('saved_items').delete().eq('user_id', user.id).eq('product_id', id.data);
    return error ? { ok: false, message: 'Could not remove this item. Please try again.' } : { ok: true, saved: false };
  }
  const { error } = await s.from('saved_items').insert({ user_id: user.id, product_id: id.data });
  if (error && error.code !== '23505') return { ok: false, message: 'Could not save this item. Please try again.' }; // 23505 = already saved
  return { ok: true, saved: true };
}
