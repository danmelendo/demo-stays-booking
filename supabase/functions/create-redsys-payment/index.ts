/**
 * create-redsys-payment
 *
 * Generates the signed form fields required to redirect the browser to
 * the Redsys TPV (HMAC_SHA256_V1 / SHA-256 + 3DES).
 *
 * Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   REDSYS_MERCHANT_CODE   Ds_Merchant_MerchantCode  (e.g. "123456789")
 *   REDSYS_TERMINAL        Ds_Merchant_Terminal       (e.g. "001")
 *   REDSYS_SECRET_KEY      Base64-encoded secret key provided by the bank
 *   REDSYS_ENVIRONMENT     "test" | "production"
 *   REDSYS_MERCHANT_URL    Server-to-server notification URL (your webhook endpoint)
 *   REDSYS_URL_OK          Browser redirect URL after successful payment
 *   REDSYS_URL_KO          Browser redirect URL after failed payment
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";

// BBVA/Redsys payment endpoints
// Admin portal (test): https://sis-t.redsys.es:25443/portalBBVA
const REDSYS_TEST = "https://sis-t.redsys.es:25443/sis/realizarPago";
const REDSYS_PROD = "https://sis.redsys.es/sis/realizarPago";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── Pure-JS 3DES (ECB, single block) ─────────────────────────────────────────
// Deno/OpenSSL 3.x disables legacy DES ciphers, so we cannot use createCipheriv.
// Redsys only encrypts one 8-byte block (no CBC chaining needed).

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

function _desSubkeys(k8: Uint8Array): number[][] {
  let kp = _perm(_bits(k8), _PC1);
  let C = kp.slice(0, 28), D = kp.slice(28);
  return _SHI.map(s => { C = _rol(C, s); D = _rol(D, s); return _perm([...C, ...D], _PC2); });
}

function _desBlock(k8: Uint8Array, blk: Uint8Array, enc: boolean): Uint8Array {
  const sks = _desSubkeys(k8); if (!enc) sks.reverse();
  const b = _perm(_bits(blk), _IP);
  let L = b.slice(0, 32), R = b.slice(32);
  for (const sk of sks) {
    const xr = _perm(R, _E).map((v, i) => v ^ sk[i]);
    const f: number[] = [];
    for (let i = 0; i < 8; i++) {
      const s = xr.slice(i * 6, i * 6 + 6);
      const v = _SBX[i][((s[0] << 1) | s[5]) * 16 + ((s[1] << 3) | (s[2] << 2) | (s[3] << 1) | s[4])];
      for (let b = 3; b >= 0; b--) f.push((v >> b) & 1);
    }
    const fp = _perm(f, _P);
    [L, R] = [R, L.map((v, i) => v ^ fp[i])];
  }
  return _bytes(_perm([...R, ...L], _FP));
}

function _3des(key: Uint8Array, blk: Uint8Array): Uint8Array {
  const k1 = key.slice(0, 8), k2 = key.slice(8, 16), k3 = key.length >= 24 ? key.slice(16, 24) : key.slice(0, 8);
  return _desBlock(k3, _desBlock(k2, _desBlock(k1, blk, true), false), true);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Redsys HMAC_SHA256_V1 signature:
 *  1. Derive per-transaction key: 3DES-CBC(secretKey, orderId null-padded to multiple of 8), IV=zeros
 *  2. HMAC-SHA256(merchantParamsBase64, derivedKey) → base64
 *
 * The order can be up to 12 chars, so the derived key is 16 bytes for orders 9–16 chars long.
 */
function redsysSignature(secretKeyB64: string, order: string, merchantParamsB64: string): string {
  const key = new Uint8Array(Buffer.from(secretKeyB64, "base64"));

  // Null-pad ASCII order to next multiple of 8 bytes
  const orderRaw = new Uint8Array(Buffer.from(order, "ascii"));
  const paddedLen = Math.max(8, Math.ceil(orderRaw.length / 8) * 8);
  const padded = new Uint8Array(paddedLen);
  padded.set(orderRaw);

  // 3DES-CBC encrypt with IV = 0s, manual block chaining since _3des is ECB-single-block
  let prev = new Uint8Array(8); // IV
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

/** Generate a Redsys-valid order number: 4 digits (MMDD) + 4 UUID hex + 4 timestamp hex.
 *  The timestamp component prevents SIS0076 duplicate-order rejection on same-day retries. */
function buildOrder(reservationId: string): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const uuidHex = reservationId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const tsHex = (now.getTime() & 0xffff).toString(16).padStart(4, "0").toUpperCase();
  return `${mm}${dd}${uuidHex}${tsHex}`; // 12 chars, starts with 4 digits
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { reservation_id } = await req.json() as { reservation_id: string };
    if (!reservation_id) return json({ error: "reservation_id required" }, 400);

    // ── Supabase ──────────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reservation, error: dbErr } = await supabase
      .from("reservations")
      .select("id, deposit_amount, deposit_paid")
      .eq("id", reservation_id)
      .single();

    if (dbErr || !reservation) return json({ error: "Reserva no encontrada" }, 404);
    if (reservation.deposit_paid) return json({ error: "Esta reserva ya tiene el depósito pagado" }, 409);

    // Guard: deposit must be > 0 (Redsys rejects zero-amount transactions)
    const depositAmount = Number(reservation.deposit_amount);
    if (!depositAmount || depositAmount <= 0) {
      return json({ error: "El importe del depósito no es válido" }, 422);
    }

    // ── Redsys params ─────────────────────────────────────────────────────
    // ── Bypass mode (REDSYS_BYPASS=true) ─────────────────────────────────
    // Marks the reservation as paid immediately without going through Redsys.
    // Use only for local/staging testing — NEVER enable in production.
    if (Deno.env.get("REDSYS_BYPASS") === "true") {
      console.warn("create-redsys-payment: BYPASS MODE — skipping Redsys, marking paid directly");
      const urlOkBypass = Deno.env.get("REDSYS_URL_OK") ?? "/";
      await supabase.from("reservations").update({
        deposit_paid: true,
        paid_amount: depositAmount,
        status: "confirmed",
        redsys_order: `BYPASS-${reservation_id.slice(0, 8)}`,
      }).eq("id", reservation_id);
      try {
        await supabase.functions.invoke("send-reservation-confirmation", {
          body: { reservation_id },
        });
      } catch (e) {
        console.warn("create-redsys-payment: bypass email failed", e);
      }
      return json({ bypass: true, redirectUrl: urlOkBypass });
    }

    // ── Redsys params ─────────────────────────────────────────────────────
    const merchantCode = Deno.env.get("REDSYS_MERCHANT_CODE");
    const terminal = Deno.env.get("REDSYS_TERMINAL") ?? "001";
    const secretKey = Deno.env.get("REDSYS_SECRET_KEY");
    const isProd = Deno.env.get("REDSYS_ENVIRONMENT") === "production";
    const notifUrl = Deno.env.get("REDSYS_MERCHANT_URL");
    const urlOk = Deno.env.get("REDSYS_URL_OK");
    const urlKo = Deno.env.get("REDSYS_URL_KO");

    console.log("[redsys-config]", {
      env: Deno.env.get("REDSYS_ENVIRONMENT"),
      isProd,
      action: isProd ? REDSYS_PROD : REDSYS_TEST,
      merchantCode,
      terminal,
      secretKeyLen: secretKey?.length,
      urlOk,
      urlKo,
    });

    if (!merchantCode || !secretKey || !notifUrl || !urlOk || !urlKo) {
      console.error("create-redsys-payment: missing required env vars");
      return json({ error: "Configuración de pago incompleta (contacta al administrador)" }, 503);
    }

    const order = buildOrder(reservation_id);

    // Amount in cents (EUR) — plain string, no zero-padding (Redsys rejects leading zeros with SIS0018)
    const amountCents = String(Math.round(depositAmount * 100));

    const merchantParams = {
      DS_MERCHANT_MERCHANTCODE: merchantCode,
      DS_MERCHANT_TERMINAL: terminal,
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_AMOUNT: amountCents,
      DS_MERCHANT_CURRENCY: "978",          // EUR
      DS_MERCHANT_TRANSACTIONTYPE: "0",     // Authorisation
      DS_MERCHANT_MERCHANTURL: notifUrl,
      DS_MERCHANT_URLOK: `${urlOk}?order=${order}`,
      DS_MERCHANT_URLKO: `${urlKo}?order=${order}&ko=1`,
      DS_MERCHANT_CONSUMERLANGUAGE: "002",  // Spanish
    };

    const merchantParamsB64 = btoa(JSON.stringify(merchantParams));
    const signature = redsysSignature(secretKey, order, merchantParamsB64);

    console.log("[redsys-params]", {
      order,
      amountCents,
      depositAmount,
      reservation_id,
      merchantParams,
      merchantParamsB64Len: merchantParamsB64.length,
      signature,
    });

    // Save order reference to reservation — must succeed or notification webhook can't match the payment
    const { error: updateErr } = await supabase.from("reservations").update({ redsys_order: order }).eq("id", reservation_id);
    if (updateErr) {
      console.error("create-redsys-payment: failed to save redsys_order", updateErr);
      return json({ error: "No se pudo iniciar el pago. Inténtalo de nuevo." }, 500);
    }

    return json({
      action: isProd ? REDSYS_PROD : REDSYS_TEST,
      formFields: {
        Ds_SignatureVersion: "HMAC_SHA256_V1",
        Ds_MerchantParameters: merchantParamsB64,
        Ds_Signature: signature,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
