# Turnero

Sistema de turnos simple para cualquier negocio: el cliente saca su número, quien atiende lo llama y la pantalla de la sala lo anuncia con un timbre y una voz.

## Pantallas

| Dirección      | Para quién          | Qué hace |
|----------------|---------------------|----------|
| `/`            | Clientes (tótem, tablet o celular) | Elegir el motivo de la visita y sacar el número. Muestra cuántas personas hay antes. |
| `/mostrador`   | Personal (con PIN)  | Llamar al siguiente, repetir el llamado, marcar "atendido" o "no vino", llamar un número puntual. |
| `/pantalla`    | TV de la sala       | Número llamado en grande, puesto, últimos llamados, timbre y voz. |
| `/configurar`  | Personal (con PIN)  | Nombre del negocio, sectores (letra, nombre y color), cantidad de puestos, voz sí/no, reiniciar numeración. |

- La numeración es por sector (A-001, C-001…) y se reinicia sola cada día.
- Todas las pantallas se actualizan solas cada 1,5 segundos.
- Cada mostrador recuerda su número de puesto y el sector que atiende.
- En la TV hay que tocar la pantalla una vez al abrirla para habilitar el sonido (lo exigen los navegadores).

## Cómo correrlo

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev        # desarrollo: http://localhost:9002
```

Para usarlo en un local:

```bash
npm run build
npm start          # queda accesible en la red: http://IP-DE-LA-PC:9002
```

Se instala en una sola computadora del local. El tótem, el mostrador y la TV abren la dirección de esa computadora desde el navegador, conectados a la misma red.

### PIN del personal

Por defecto es `1234`. Para cambiarlo, crear un archivo `.env.local` (ver `.env.example`):

```
TURNERO_PIN=4821
```

## Publicarlo en Vercel

1. Importar el repositorio en Vercel (se detecta solo como Next.js).
2. En el proyecto de Vercel: **Storage → Create Database → Upstash (Redis) → Connect**. Es gratis para este uso y crea solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. En **Settings → Environment Variables** agregar `TURNERO_PIN` con el PIN que quieras.
4. Volver a hacer deploy (**Deployments → ⋯ → Redeploy**).

Si falta el paso 2, las pantallas muestran un mensaje que explica qué conectar.

## Dónde se guardan los datos

- **Con Redis** (Vercel): en la base Upstash conectada.
- **Sin Redis** (una computadora del local): en `data/turnero.json`, que se crea solo. No se pierde nada si se reinicia la computadora. La carpeta se puede cambiar con `TURNERO_DATA_DIR`.

La numeración se reinicia a medianoche de Montevideo. Para otra zona horaria: `TURNERO_TZ=America/Argentina/Buenos_Aires`.

## Estructura

```
src/
  app/
    page.tsx              Tótem del cliente
    mostrador/page.tsx    Mostrador
    pantalla/page.tsx     Pantalla de sala
    configurar/page.tsx   Configuración
    api/                  state, tickets, desk, config, reset, login
  components/             PinGate (pedir PIN), StaffNav (menú del personal)
  lib/
    store.ts              Lógica de turnos
    storage.ts            Guardado: Redis (Vercel) o archivo JSON
    client.ts             Actualización automática, sonido y voz
    types.ts              Tipos compartidos
```

Tecnologías: Next.js 15, React 18, TypeScript, Tailwind CSS.
