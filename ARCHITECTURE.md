# Arquitectura e ingeniería

> **Por qué existe este documento.** Lo que se ejecuta al abrir la demo es la **punta visible**
> de un sistema en producción. El esfuerzo de ingeniería real —pagos regulados, seguridad de
> datos por filas, flujos de pago asíncronos, modelo de dominio de precios— vive en capas que
> el navegador **no necesita** para enseñar la aplicación. Como la demo sustituye ese backend
> por un mock, aquí se describe lo que se reemplazó y por qué es la parte cara.
>
> Resumen honesto: la demo prioriza que cualquiera vea la arquitectura y el flujo **sin instalar
> nada**. No es una medida del trabajo que hay detrás.

---

## 1. La demo esconde la parte cara (qué sustituye y qué cuesta de verdad)

| Componente real (producción) | En esta demo | Complejidad | Por qué cuesta |
|---|---|---|---|
| Firma **Redsys/TPV** server-side + webhook | Pago simulado, no-op | **Alta** | Específica de España, regulada; criptografía + flujo asíncrono |
| **Políticas RLS** por rol en Postgres | Mock sin auth real | **Alta** | Es seguridad de datos, no `if (isAdmin)` en el cliente |
| **Edge Functions** (Deno) + gestión de secretos | No-op / mock en navegador | Media-alta | La clave secreta nunca toca el navegador |
| Esquema **Postgres** + migraciones (13 tablas) | Dataset en `localStorage` | Media | Modelo de dominio real, relaciones, enums |
| **Realtime** (nuevas reservas) | Canal simulado | Media | Suscripciones servidor→cliente |
| Email transaccional (**Resend**) | Desactivado | Baja-media | Disparado tras confirmación de pago |

Todo lo demás —UI, rutas, motor de precios, capa de datos— es **el mismo código** en demo y en
producción. Eso es posible gracias a la decisión de diseño de la sección 4.

---

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Framework | TanStack Start / Router (SPA sobre Vite 7) |
| UI | React 19, Tailwind CSS v4, Radix UI / shadcn, `react-hook-form` + Zod |
| Estado servidor | TanStack Query |
| Backend (producción) | Supabase — Postgres, Row Level Security, Auth, Edge Functions (Deno) |
| Backend (demo) | Mock en navegador (`src/integrations/demo/`) sobre `localStorage` |
| Pagos | Redsys/TPV — firma 3DES + HMAC-SHA256 *(simulado en la demo)* |
| Email | Resend *(desactivado en la demo)* |
| Tooling | TypeScript, ESLint, Prettier, Bun |

Magnitud aproximada: ~11.000 líneas en `src/` (TS/TSX), 14 rutas, ~46 componentes UI.

---

## 3. Modelo de datos (13 tablas)

Esquema real reflejado en [`src/integrations/supabase/types.ts`](src/integrations/supabase/types.ts)
(tipos generados desde Postgres). El mock de la demo imita esta misma forma.

**Reservas y clientes**
- `reservations` — reserva con estado (enum de 7 valores: `pending`, `confirmed`, `in_progress`,
  `completed`, `cancelled`, `no_show`, `rejected`), franja horaria, importes y señal.
- `reservation_extras` — extras asociados a cada reserva (N:M con cantidades).
- `customers` — datos de contacto del cliente.

**Catálogo**
- `rooms` — habitaciones, con estado operativo (`available`, `occupied`, `cleaning`,
  `out_of_service`) y opción de jacuzzi (`none`, `optional`, `always`).
- `extras` — extras por categoría (`decoration`, `drinks`, `hookah`, `accessories`, `services`).

**Tarifas y precios** (el dominio rico, ver sección 5)
- `rate_groups` — agrupaciones de tarifa por tipo de habitación.
- `rate_hourly` — precio por duración (60–360 min) con/sin jacuzzi.
- `rate_overnight` — precio de noche completa por hora de checkout.
- `rate_third_person` — recargo por persona adicional, por duración.
- `dynamic_rules` — reglas de precio dinámico (`occupancy` | `date`) con multiplicador y config JSON.
- `gift_thresholds` — extras de regalo al superar un umbral de gasto.

**Seguridad y auditoría**
- `user_roles` — rol por usuario (`admin`, `reception`, `customer`).
- `audit_log` — traza de acciones (entidad, acción, payload, usuario).

**Funciones / RPC**
- `has_role(_user_id, _role)` — función *security definer* usada por las políticas RLS para
  comprobar el rol sin exponer la tabla `user_roles` al cliente.

---

## 4. Decisión de diseño clave: capa de datos agnóstica al backend

Toda la aplicación importa **un único cliente**:

```ts
import { supabase } from "@/integrations/supabase/client";
```

Ese módulo ([`client.ts`](src/integrations/supabase/client.ts)) decide en tiempo de ejecución
qué hay detrás:

- **Con** credenciales `VITE_SUPABASE_*` → cliente real de Supabase.
- **Sin** credenciales (`IS_DEMO`) → mock en navegador, vía un `Proxy` con instanciación perezosa.

```ts
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
// ...
return IS_DEMO ? createMockClient() : createRealClient();
```

**Consecuencia:** ni una sola pantalla, hook o consulta sabe si habla con Postgres o con el
mock. El resto del código es indiferente. Esto es lo que permite que el repo de portfolio sea
**autónomo** (demo sin servidor) y a la vez **el mismo código** que corre en producción —no es
una rama paralela ni una maqueta aparte.

El mock ([`mock-client.ts`](src/integrations/demo/mock-client.ts), ~430 LOC) reimplementa la
porción de la API de Supabase que la app usa de verdad:

- **Query builder PostgREST:** `select / insert / update / delete` encadenados con
  `eq, neq, gt, gte, lt, lte, in, not, is, order, limit, range, single, maybeSingle` y
  `count` exacto (incluido `head: true`).
- **Auth:** `signIn`, `signOut`, `getSession`, `onAuthStateChange`.
- **`rpc`**, **`functions.invoke`** y un canal **Realtime** simulados.

El dataset semilla ([`seed.ts`](src/integrations/demo/seed.ts)) replica la forma del esquema
real, se persiste en `localStorage` (con versionado para forzar reseed) y se puede reiniciar
desde el aviso flotante «Modo demo».

---

## 5. Motor de precios (lógica de negocio real, no simulada)

[`src/lib/pricing.ts`](src/lib/pricing.ts) calcula el precio combinando varias fuentes —esto
**sí** es la lógica real, idéntica en demo y producción:

1. **Base:** tarifa por horas (según duración y jacuzzi) **o** noche completa según checkout.
2. **Tercera persona:** recargo por persona adicional (solo en tarifa por horas).
3. **Precio dinámico:**
   - **Por fecha:** reglas con rango `from`–`to` que aplican un `+%` (p. ej. temporada alta).
   - **Por ocupación:** calcula la ocupación real del día (reservas activas / habitaciones
     activas) y aplica el recargo del umbral más alto superado.
4. **Regalos por umbral:** si el gasto en extras supera un mínimo, marca extras como regalo.

Devuelve un desglose tipado (`PriceBreakdown`) con base, recargos, motivo del recargo dinámico,
total de extras, IDs regalados y total. Es un cálculo con varias consultas coordinadas, no una
multiplicación.

---

## 6. Separación de limpieza entre reservas (anti-solapamiento)

Requisito operativo del negocio: una habitación necesita **tiempo de limpieza** entre dos
reservas y no puede reservarse durante ese margen. Se modela como una propiedad de cada reserva
(`cleaning_minutes`, mínimo 15) y se hace cumplir en el backend, no en la UI.

- **Ventana ocupada.** Cada reserva ocupa la habitación en `[start_at, end_at + cleaning_minutes)`.
  Dos reservas chocan si sus ventanas se solapan. En producción es un **trigger en Postgres**
  (`check_reservation_gap`) que usa solapamiento de rangos `tstzrange`; en esta demo se reimplementa
  la misma lógica en el mock ([`mock-client.ts`](src/integrations/demo/mock-client.ts),
  `checkReservationGap`), de modo que un `insert`/`update` que solape **falla** igual que contra
  la base real.
- **Reservas que bloquean.** Cuentan las `confirmed/in_progress/completed` siempre, y las
  `pending` sólo si son recientes (< 60 min), para que un pago público abandonado **libere el hueco**.
  Las `cancelled/no_show/rejected` nunca bloquean.
- **Override de administración.** Una reserva marcada `manual_override` se salta la comprobación
  (excepciones puntuales) — mismo comportamiento que el trigger real.
- **Ampliar limpieza y desplazar en cascada.** Si una habitación necesita más limpieza, recepción
  amplía el margen y las reservas posteriores **se reprograman automáticamente** hasta que termina.
  Es una función `extend_cleaning_and_shift` (en producción `SECURITY DEFINER`; en la demo, RPC del
  mock) que recorre la cadena de reservas siguientes preservando su duración y para en cuanto un
  hueco absorbe el retraso. Devuelve cuántas reservas reprogramó.

Esto es lógica de negocio con estado y coordinación temporal — el tipo de detalle operativo que
distingue un producto en explotación de una maqueta.

---

## 7. Gestión de reservas desde recepción

- **Crear y editar.** El mismo diálogo crea o edita una reserva (clic en una reserva del
  calendario o del listado para editarla): carga datos y extras, recalcula precio y guarda.
- **Sin veto de horario para personal.** El portal **público** mantiene su restricción de franja
  (jue/vie/sáb por teléfono, noche completa sólo dom–mié); **recepción y administración pueden
  reservar a cualquier hora**. El gating se hace por rol del flujo (`isPublic`), no por admin.
- **Override de admin.** Permite fijar hora de fin y total manual, y se salta la separación de
  limpieza para casos especiales.

---

## 8. Lo que justifica el coste (resumen para evaluación técnica)

- **Pasarela Redsys segura por diseño.** Clave secreta solo en servidor; firma generada en una
  Edge Function derivando la clave por **3DES** sobre el número de pedido y firmando con
  **HMAC-SHA256**. Es la parte específica de España, regulada, y la que más distingue esto de
  un CRUD.
- **Confirmación de pago asíncrona.** El estado definitivo llega por **webhook servidor-a-servidor**
  de Redsys, no por la redirección del usuario. Implica idempotencia, reconciliación de estados
  y tolerancia a que el usuario abandone el navegador.
- **Seguridad de datos con RLS.** Políticas por rol en Postgres apoyadas en `has_role` (security
  definer): el rol anónimo solo puede **crear** reservas, nunca leer datos de otros clientes.
- **Modelo de dominio no trivial.** 13 tablas, 6 enums, precios dinámicos por fecha y ocupación,
  señal parcial online / resto en el local.
- **Anti-solapamiento con limpieza** hecho cumplir en el backend, con reprogramación en cascada
  de las reservas siguientes (sección 6) — lógica con estado y coordinación temporal.
- **Arquitectura desacoplada** que permite el mismo código en demo y producción (sección 4).
- **Panel operativo real:** calendario, agenda del día, gestión de reservas/clientes/tarifas/
  extras, informes y notificaciones en tiempo real — software que recepción usa a diario.

### Edge Functions (Deno, en `supabase/functions/`)

Tres funciones server-side, no incluidas en este repo. El reparto de `verify_jwt` es en sí una
decisión de seguridad:

| Función | Propósito | `verify_jwt` |
|---|---|---|
| `create-redsys-payment` | Genera la petición de pago Redsys (firma server-side) | `true` |
| `redsys-notification` | Recibe el callback de Redsys y valida el HMAC | `false` |
| `send-reservation-confirmation` | Envía el email de confirmación (Resend) | `false` |

`redsys-notification` es público a propósito: lo invoca **Redsys servidor-a-servidor**, sin JWT
de usuario; su autenticación es la **validación de la firma HMAC**, no el token. Esa es justo la
diferencia entre un webhook hecho bien y uno que confía en la redirección del navegador.

---

## 9. Producción

- **Backend:** Supabase (Postgres + RLS + Auth + Edge Functions en Deno).
- **Hosting/despliegue:** Cloudflare Workers — TanStack Start servido vía
  `@cloudflare/vite-plugin` (`wrangler.jsonc`).
- **Edge Functions:** 3 (ver sección 8).
- **En explotación desde:** marzo de 2026.
- **Escala:** 3 sedes, 15 habitaciones (reserva por horas).
- **Tracción:** en producción genera ingresos recurrentes de **decenas de miles de € al mes**.

---

*Versión saneada para portfolio. El backend (esquema, migraciones y Edge Functions) no se
incluye para no exponer datos del cliente; la demo lo sustituye por el mock descrito arriba.*
