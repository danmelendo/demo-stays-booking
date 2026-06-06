# Demo Stays · Motor de reservas y panel de recepción

> Aplicación full‑stack de reservas para un negocio de habitaciones temáticas por horas:
> portal público de reserva con pasarela de pago real y panel interno de gestión para recepción.
>
> ⚠️ **Repositorio de portfolio.** Es una versión *anonimizada* de un proyecto real en producción.
> Se han sustituido marca, datos de contacto, credenciales e imágenes por valores de ejemplo.
> No contiene claves, datos de clientes ni de personal reales.

---

## ✨ Qué hace

**Portal público de reserva** (`/reservar`)
- Búsqueda de disponibilidad por sede, fecha, duración y nº de personas.
- Catálogo de habitaciones temáticas con galería y precios por tramo horario.
- Extras configurables (decoración, bebidas, cachimba, accesorios) con mensajes
  personalizados para las decoraciones de gama alta.
- Cálculo de precio en cliente + reserva con **señal del 30 % online** y resto en el hotel.
- Pago real integrado con **Redsys / TPV** (firma HMAC con clave derivada por **3DES**).
- Email de confirmación transaccional (Resend) tras el pago.

**Panel interno de recepción** (`/_app/*`)
- Calendario y agenda del día, gestión de reservas, clientes y tarifas.
- Roles (administrador / recepción) con control de acceso.
- Catálogo de extras y tarifas editable.

## 🧱 Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | **TanStack Start** (SSR) + **TanStack Router** |
| UI | React 19, Tailwind CSS, Radix UI / shadcn, `react-hook-form` + Zod |
| Datos cliente | TanStack Query |
| Backend | **Supabase** — Postgres, Row Level Security, Auth, **Edge Functions** (Deno) |
| Pagos | **Redsys** (creación de pago + notificación asíncrona, firma `3DES` + `HMAC‑SHA256`) |
| Email | Resend |
| Build / Deploy | Vite 7, **Cloudflare** (`@cloudflare/vite-plugin`, Wrangler) |
| Tooling | TypeScript, ESLint, Prettier, Bun |

## 🏗️ Arquitectura

```
src/
  routes/            Rutas TanStack (público: /reservar, /reservar-ok; interno: /_app/*)
  components/        UI compartida y diálogos (NewReservationDialog, AppSidebar, ...)
  integrations/      Cliente Supabase (browser + server) y middleware de auth
  lib/               Lógica de precios, datos y helpers
supabase/
  migrations/        Esquema versionado (rooms, rates, reservations, extras, RLS, staff)
  functions/         Edge Functions: create-redsys-payment, redsys-notification,
                     send-reservation-confirmation
```

Aspectos destacables a nivel de ingeniería:
- **Pasarela de pago server‑side segura:** la clave secreta nunca toca el navegador; la firma
  Redsys se genera en una Edge Function derivando la clave por 3DES sobre el número de pedido.
- **Flujo de pago asíncrono:** la confirmación llega por notificación servidor‑a‑servidor
  (webhook de Redsys), no por la redirección del usuario.
- **Seguridad de datos con RLS:** políticas por rol en Postgres; el rol anónimo solo puede
  crear reservas, no leer datos de otros.
- **SSR + hidratación** con TanStack Start desplegado sobre el runtime de Cloudflare.

## 🚀 Puesta en marcha

```bash
bun install            # o npm install
cp .env.example .env    # rellena con tu propio proyecto Supabase de pruebas
bun run dev            # arranca Vite en modo desarrollo
```

Para un entorno funcional necesitas:
1. Un proyecto **Supabase** propio y aplicar las migraciones de `supabase/migrations`.
2. Configurar las variables de `.env` (ver `.env.example`).
3. (Opcional) Credenciales de **Redsys en entorno de pruebas** para el pago real, o
   `REDSYS_BYPASS=true` para saltar la pasarela en local.

Las migraciones siembran usuarios de demo (p. ej. `admin@demostays.example`) con
**contraseñas de ejemplo** — cámbialas en cualquier despliegue propio.

## 📷 Imágenes

Las fotografías reales del negocio se han reemplazado por **placeholders generados** en
`public/imagenes/` y `src/assets/`. El diseño y la maquetación son los originales.

---

*Proyecto desarrollado por mí como aplicación real en producción; este repositorio es una
versión saneada para mostrar la arquitectura y el código sin exponer datos sensibles.*
