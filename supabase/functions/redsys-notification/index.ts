/**
 * redsys-notification  (server-to-server webhook)
 *
 * Redsys POSTs here after every transaction attempt.
 * We verify the HMAC_SHA256_V1 signature, and on success we mark the
 * reservation deposit as paid and send the confirmation email.
 *
 * Register this URL in your Redsys merchant panel as "URL de notificación".
 * It must be publicly reachable (Supabase Edge Function URL is fine).
 *
 * Environment variables required:
 *   REDSYS_SECRET_KEY   Base64-encoded secret key (same as in create-redsys-payment)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";

// ── Pure-JS 3DES (same implementation as create-redsys-payment) ──────────────
const _IP  = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const _FP  = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const _E   = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const _P   = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const _PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const _PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const _SHI = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const _SBX = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11],
];
function _perm(bits: number[], tbl: number[]): number[] { return tbl.map(p => bits[p - 1]); }
function _bits(b: Uint8Array): number[] { const r: number[] = []; for (const x of b) for (let i = 7; i >= 0; i--) r.push((x >> i) & 1); return r; }
function _bytes(bits: number[]): Uint8Array { const r = new Uint8Array(bits.length >> 3); for (let i = 0; i < r.length; i++) for (let j = 0; j < 8; j++) r[i] = (r[i] << 1) | bits[i * 8 + j]; return r; }
function _rol(a: number[], n: number): number[] { return [...a.slice(n), ...a.slice(0, n)]; }
function _desSubkeys(k8: Uint8Array): number[][] { let kp = _perm(_bits(k8), _PC1); let C = kp.slice(0, 28), D = kp.slice(28); return _SHI.map(s => { C = _rol(C, s); D = _rol(D, s); return _perm([...C, ...D], _PC2); }); }
function _desBlock(k8: Uint8Array, blk: Uint8Array, enc: boolean): Uint8Array {
  const sks = _desSubkeys(k8); if (!enc) sks.reverse();
  const b = _perm(_bits(blk), _IP); let L = b.slice(0, 32), R = b.slice(32);
  for (const sk of sks) { const xr = _perm(R, _E).map((v, i) => v ^ sk[i]); const f: number[] = []; for (let i = 0; i < 8; i++) { const s = xr.slice(i*6,i*6+6); const v = _SBX[i][((s[0]<<1)|s[5])*16+((s[1]<<3)|(s[2]<<2)|(s[3]<<1)|s[4])]; for (let b=3;b>=0;b--) f.push((v>>b)&1); } [L,R]=[R,L.map((v,i)=>v^_perm(f,_P)[i])]; }
  return _bytes(_perm([...R,...L],_FP));
}
function _3des(key: Uint8Array, blk: Uint8Array): Uint8Array { const k1=key.slice(0,8),k2=key.slice(8,16),k3=key.length>=24?key.slice(16,24):key.slice(0,8); return _desBlock(k3,_desBlock(k2,_desBlock(k1,blk,true),false),true); }
// ─────────────────────────────────────────────────────────────────────────────

function redsysSignature(secretKeyB64: string, order: string, merchantParamsB64: string): string {
  // Per-transaction key = 3DES-CBC(secretKey, order null-padded to a multiple of
  // 8 bytes), IV = zeros. The order can be up to 12 chars (→ 16-byte / 2-block
  // derivation), so we MUST chain blocks with CBC — a single 8-byte ECB block
  // would only cover the first 8 chars and produce a wrong key, making every
  // notification fail signature verification. Mirrors create-redsys-payment.
  const key = new Uint8Array(Buffer.from(secretKeyB64, "base64"));

  const orderRaw = new Uint8Array(Buffer.from(order, "ascii"));
  const paddedLen = Math.max(8, Math.ceil(orderRaw.length / 8) * 8);
  const padded = new Uint8Array(paddedLen);
  padded.set(orderRaw);

  let prev = new Uint8Array(8); // IV = 0s
  const derived = new Uint8Array(paddedLen);
  for (let i = 0; i < paddedLen; i += 8) {
    const xored = new Uint8Array(8);
    for (let j = 0; j < 8; j++) xored[j] = padded[i + j] ^ prev[j];
    const enc = _3des(key, xored);
    derived.set(enc, i);
    prev = enc;
  }

  return createHmac("sha256", Buffer.from(derived)).update(merchantParamsB64).digest("base64");
}

/** Normalise base64 so + and - / _ variants compare equal */
function normaliseB64(s: string) {
  return s.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/")).replace(/=*$/, "");
}

Deno.serve(async (req) => {
  // Redsys sends application/x-www-form-urlencoded
  let body: string;
  try {
    body = await req.text();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const params = new URLSearchParams(body);
  const signatureVersion = params.get("Ds_SignatureVersion");
  const merchantParamsB64 = params.get("Ds_MerchantParameters");
  const receivedSig = params.get("Ds_Signature");

  if (signatureVersion !== "HMAC_SHA256_V1" || !merchantParamsB64 || !receivedSig) {
    console.error("redsys-notification: missing or unknown signature version");
    return new Response("Bad request", { status: 400 });
  }

  // Decode merchant params
  let merchantParams: Record<string, string>;
  try {
    merchantParams = JSON.parse(atob(merchantParamsB64));
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const order = merchantParams.Ds_Order;
  const responseCode = parseInt(merchantParams.Ds_Response ?? "9999", 10);

  if (!order) {
    console.error("redsys-notification: missing Ds_Order");
    return new Response("Bad request", { status: 400 });
  }

  // ── Verify signature ────────────────────────────────────────────────────
  const secretKey = Deno.env.get("REDSYS_SECRET_KEY");
  if (!secretKey) {
    console.error("redsys-notification: REDSYS_SECRET_KEY env var is not set");
    return new Response("Internal Server Error", { status: 500 });
  }
  const expectedSig = redsysSignature(secretKey, order, merchantParamsB64);

  if (normaliseB64(expectedSig) !== normaliseB64(receivedSig)) {
    console.error("redsys-notification: signature mismatch for order", order);
    return new Response("Forbidden", { status: 403 });
  }

  // ── Update DB ──────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Response codes 0–99 = authorised; anything else = error/refused
  const authorised = responseCode >= 0 && responseCode <= 99;
  console.log(`redsys-notification: order=${order} code=${responseCode} authorised=${authorised}`);

  if (authorised) {
    const amountCents = parseInt(merchantParams.Ds_Amount ?? "0", 10);
    const paidAmount = amountCents / 100;

    const { data: reservation, error: findErr } = await supabase
      .from("reservations")
      .select("id, deposit_paid")
      .eq("redsys_order", order)
      .maybeSingle();

    if (findErr || !reservation) {
      console.error("redsys-notification: reservation not found for order", order);
      // Return 200 so Redsys doesn't keep retrying for a known bad state
      return new Response("OK");
    }

    if (!reservation.deposit_paid) {
      const { error: markErr } = await supabase.from("reservations").update({
        deposit_paid: true,
        paid_amount: paidAmount,
        status: "confirmed",
      }).eq("id", reservation.id);

      if (markErr) {
        console.error("redsys-notification: failed to mark deposit_paid for order", order, markErr);
        // Return non-200 so Redsys retries
        return new Response("DB Error", { status: 500 });
      }

      // Trigger confirmation email
      try {
        await supabase.functions.invoke("send-reservation-confirmation", {
          body: { reservation_id: reservation.id },
        });
      } catch (e) {
        console.warn("redsys-notification: email send failed", e);
      }
    }
  } else {
    // Payment refused/error: mark the reservation as rejected (only while it is
    // still unpaid, so we never overwrite an already-confirmed/paid booking).
    const { data: reservation } = await supabase
      .from("reservations")
      .select("id, deposit_paid")
      .eq("redsys_order", order)
      .maybeSingle();
    if (reservation && !reservation.deposit_paid) {
      const { error: rejErr } = await supabase
        .from("reservations")
        .update({ status: "rejected" })
        .eq("id", reservation.id);
      if (rejErr) console.error("redsys-notification: failed to mark rejected for order", order, rejErr);
    }
  }

  // Redsys expects a 200 response with any body to acknowledge receipt
  return new Response("OK");
});
