# Demo Stays · Motor de reservas y panel de recepción

> Aplicación full‑stack de reservas para un negocio de habitaciones temáticas por horas:
> portal público de reserva con pasarela de pago y panel interno de gestión para recepción.
>
> ⚠️ **Repositorio de portfolio.** Es una versión *anonimizada* de un proyecto real en producción.
> Se han sustituido marca, datos de contacto, credenciales e imágenes por valores de ejemplo.
> No contiene claves, datos de clientes ni de personal reales.

---

## 🧪 Esta demo funciona SIN backend

Para que cualquiera pueda **abrir y probar la aplicación sin instalar ni configurar nada**,
esta versión **no incluye el backend**. El proyecto real se apoya en **Supabase** (Postgres,
Auth, Edge Functions), **Redsys/TPV** y **Resend**; reproducir eso exigiría crear un proyecto
Supabase, aplicar migraciones, dar de alta credenciales de pago y configurar secretos — una
barrera que impediría ver la funcionalidad de un vistazo.

En su lugar, cuando **no hay credenciales de Supabase configuradas**, la app arranca contra un
**backend simulado que vive en tu navegador** (`src/integrations/demo/`):

- Un **dataset de ejemplo en memoria** (habitaciones, tarifas, extras, clientes y reservas)
  que imita el esquema real de Postgres, **persistido en `localStorage`** para que tus cambios
  sobrevivan a recargas.
- Un **cliente mock** que reimplementa la porción de la API de Supabase que usa la app
  (query builder `from().select().eq()…`, `auth`, `rpc`, Edge Functions y Realtime), de modo
  que **ni una sola pantalla necesita tocarse**: el resto del código cree estar hablando con
  Supabase.
- El **pago Redsys se simula** (se marca la señal como pagada y redirige a la pantalla de
  confirmación) y el **email de confirmación es un no‑op**.

Verás un pequeño aviso flotante **«Modo demo»** con un botón para **reiniciar los datos** a su
estado inicial. Para conectar un Supabase real, basta con definir las variables `VITE_SUPABASE_*`
(ver más abajo): la app detecta las credenciales y deja de usar el mock automáticamente.

> El objetivo de la demo es enseñar **la arquitectura, el flujo de usuario y el código**, no
> operar un backend real. Por eso este repositorio de portfolio **no incluye** el backend
> (esquema, migraciones ni Edge Functions): la app es autónoma gracias al mock del navegador.

## 🚀 Probar la demo (sin backend)

```bash
bun install      # o npm install
bun run dev      # arranca Vite — abre la URL que imprime (p. ej. http://localhost:5173)
```

No hace falta `.env` ni ningún servicio externo. Al abrirla:

- **`/reservar`** — portal público: busca disponibilidad, elige habitación y extras, rellena
  tus datos y completa una reserva (pago simulado → pantalla de confirmación).
- **`/`** o **`/login`** — entras ya autenticado como **administrador demo** en el panel interno
  (cualquier email/contraseña sirve para volver a entrar si cierras sesión).

Datos y cambios se guardan en tu navegador; usa **«Reiniciar datos»** del aviso para restaurarlos.

## ✨ Qué hace

**Portal público de reserva** (`/reservar`)
- Búsqueda de disponibilidad por sede, fecha, duración y nº de personas.
- Catálogo de habitaciones temáticas con galería y precios por tramo horario.
- Extras configurables (decoración, bebidas, cachimba, accesorios) con mensajes
  personalizados para las decoraciones de gama alta.
- Cálculo de precio en cliente + reserva con **señal del 30 % online** y resto en el hotel.
- Pago integrado con **Redsys / TPV** (firma HMAC con clave derivada por **3DES**) — *simulado en la demo*.
- Email de confirmación transaccional (Resend) tras el pago — *desactivado en la demo*.

**Panel interno de recepción** (`/_app/*`)
- Calendario y agenda del día, gestión de reservas, clientes y tarifas.
- **Crear y editar reservas** desde el calendario o el listado (clic en una reserva para editarla).
- **Separación de limpieza entre reservas:** cada reserva bloquea la habitación un tiempo de
  limpieza (mín. 15 min) tras su fin; el sistema impide solapamientos respetando ese margen.
- **Ampliar limpieza y desplazar:** si una habitación necesita más limpieza, recepción la amplía
  y las reservas posteriores se **reprograman automáticamente** hasta que termine.
- Recepción/administración **sin restricción de horario** (cualquier hora); la limitación de
  franja sólo aplica al portal público.
- Roles (administrador / recepción) con control de acceso.
- Catálogo de extras y tarifas editable.
- **Booking journal** (`/journal`): traza inmutable del ciclo de vida de cada reserva
  (prereserva → confirmación → firma → check-in → puntos), compartida con la app móvil.
- Notificaciones en tiempo real al entrar nuevas reservas.

**App móvil de cliente «Stays»** (`/stays`)

Producto **white-label independiente** que se integra con **cualquier PMS por API** y, en esta
demo, está conectado a Demo Stays como **PMS de prueba**. Toda la app consume el PMS a través de
un **conector tipado** (`src/integrations/pms/`, interfaz `PmsConnector`): para integrar otro PMS
basta con implementar esa interfaz y cambiar el singleton — ni una pantalla cambia.

- **Discovery por provincias:** propiedades en Madrid, Barcelona, Valencia, Sevilla, Málaga y
  Bilbao, con búsqueda de disponibilidad y precios por noche.
- **Reservas y prereservas:** una *prereserva* bloquea la habitación 30 min sin pagar (con cuenta
  atrás) y se confirma pagando la señal; reutiliza el motor anti-solapamiento del PMS.
- **Firma digital:** contrato de check-in firmado en un canvas (sin dependencias), almacenado y
  registrado en el journal.
- **Club de fidelización:** niveles (Bronce→Platino), puntos por estancia, progreso de nivel,
  catálogo de recompensas canjeables y movimientos.
- **Avisos de disponibilidad (notificaciones push):** si una habitación está ocupada para tus
  fechas, «Avísame cuando se libere» registra un *watch*; cuando se libera, la app dispara una
  **notificación del navegador** (vía service worker) y un aviso in-app. En producción lo
  empujaría el PMS por webhook + Web Push/VAPID; aquí el conector reevalúa disponibilidad.
- **Comunidad:** los activos son **pisos, habitaciones y habitaciones compartidas** en
  **urbanizaciones (comunidades)**. La pestaña *Comunidad* muestra los **eventos de cada comunidad**
  servidos por un **CMS** (`src/integrations/cms/`, interfaz `CmsClient` — swappeable por un CMS
  headless real), con RSVP («apuntarme»).

**Web pública «Stays»** (`/web`) — sitio de marketing y descubrimiento alineado con la app
(responsive, sin login): landing, navegación de comunidades, ficha de comunidad (activos por tipo +
eventos) y la sección **Comunidad** (agenda de eventos). Consume el mismo conector PMS y el CMS, y
enlaza a la app para reservar/apuntarse.

## 🧱 Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | **TanStack Start / Router** (SPA con Vite) |
| UI | React 19, Tailwind CSS, Radix UI / shadcn, `react-hook-form` + Zod |
| Datos cliente | TanStack Query |
| Backend (producción) | **Supabase** — Postgres, Row Level Security, Auth, **Edge Functions** (Deno) |
| Backend (esta demo) | **Mock en navegador** (`src/integrations/demo/`) sobre `localStorage` |
| Pagos | **Redsys** (firma `3DES` + `HMAC‑SHA256`) — *simulado en la demo* |
| Email | Resend — *desactivado en la demo* |
| Tooling | TypeScript, ESLint, Prettier, Bun, Vite 7 |

## 🏗️ Arquitectura

```
src/
  routes/            Rutas TanStack (público: /reservar, /reservar-ok; interno: /_app/*)
  components/        UI compartida y diálogos (NewReservationDialog, AppSidebar, ...)
  integrations/
    supabase/        Cliente de datos: elige backend real o mock según haya credenciales + tipos
    demo/            Backend simulado de la demo: dataset seed + cliente mock
  lib/               Lógica de precios, datos y helpers
```

Aspectos destacables a nivel de ingeniería:
- **Pasarela de pago server‑side segura:** en producción la clave secreta nunca toca el
  navegador; la firma Redsys se genera en una Edge Function derivando la clave por 3DES sobre
  el número de pedido.
- **Flujo de pago asíncrono:** la confirmación llega por notificación servidor‑a‑servidor
  (webhook de Redsys), no por la redirección del usuario.
- **Seguridad de datos con RLS:** políticas por rol en Postgres; el rol anónimo solo puede
  crear reservas, no leer datos de otros.
- **Capa de datos desacoplada:** la app consume un único cliente (`@/integrations/supabase/client`)
  y todo el resto del código es agnóstico a si detrás hay Supabase real o el mock de la demo.

> 📐 **Lo que la demo no muestra está en [`ARCHITECTURE.md`](ARCHITECTURE.md):** modelo de datos
> (13 tablas), seguridad RLS, motor de precios dinámico y qué sustituye exactamente el mock —es
> decir, dónde está el grueso de la ingeniería que el navegador no necesita para la demo.

## 🔌 Versión de producción

En producción la aplicación corre sobre **Supabase** (Postgres + Row Level Security + Auth +
Edge Functions en Deno), con pagos vía **Redsys / TPV** y emails con **Resend**. Ese backend
**no se incluye** en este repositorio de portfolio para no exponer esquema ni datos del cliente;
la demo lo sustituye por el mock del navegador descrito arriba.

Si defines tus propias variables `VITE_SUPABASE_*` (ver `.env.example`), la app detecta las
credenciales y deja de usar el mock para hablar con el proyecto Supabase que apuntes.

## 📷 Imágenes

Las fotografías reales del negocio se han reemplazado por **placeholders generados** en
`public/imagenes/` y `src/assets/`. El diseño y la maquetación son los originales.

---

*Proyecto desarrollado por mí como aplicación real en producción; este repositorio es una
versión saneada para mostrar la arquitectura y el código sin exponer datos sensibles ni
depender de un backend.*
