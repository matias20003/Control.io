# Mi Brief

Mi Brief es la experiencia oficial del antiguo módulo Newsletter. Conserva las
ediciones históricas y la obtención de noticias, y agrega fuentes persistentes,
contenido social normalizado, Radar, feedback de lectura y cierre explícito.

## Integración social

La aplicación no hace scraping ni depende de la extensión de escritorio. Si no
hay proveedor social configurado, las noticias y el resto del Brief siguen
funcionando y la interfaz ofrece enlaces HTTPS a los perfiles.

Para habilitar publicaciones sociales se requieren:

- `SOCIAL_CONTENT_PROVIDER_URL`: endpoint HTTPS del proveedor autorizado.
- `SOCIAL_CONTENT_PROVIDER_TOKEN`: token Bearer de ese proveedor.

Control.io envía un `POST` con:

```json
{
  "accounts": [
    {
      "accountId": "id interno",
      "platform": "INSTAGRAM",
      "handle": "usuario",
      "profileUrl": "https://..."
    }
  ],
  "limitPerAccount": 4
}
```

El proveedor debe responder:

```json
{
  "posts": [
    {
      "accountId": "id interno",
      "externalId": "id estable de la plataforma",
      "url": "https://...",
      "title": "Resumen o caption breve",
      "thumbnailUrl": "https://...",
      "publishedAt": "2026-07-27T12:00:00.000Z",
      "metrics": { "views": 100 },
      "topicSignals": ["Arquitectura"]
    }
  ]
}
```

Las URLs deben ser HTTPS. Las métricas son opcionales y sólo se guardan cuando
el proveedor las entrega; nunca se inventan.

## Radar

`lib/services/brief/radar.ts` genera candidatos reales a partir del relevamiento
amplio de Google News. Agrupa las noticias por la URL declarada del medio,
descarta las fuentes que el usuario ya sigue o rechazó y combina señales de
afinidad temática, temas prioritarios, recencia, repetición y reputación. También
penaliza titulares promocionales o sensacionalistas.

El modo conservador exige una señal fuerte y devuelve como máximo una
sugerencia; el equilibrado devuelve hasta dos y el explorador hasta tres. Cada
candidato conserva las señales factuales que explican su inclusión. Si el
relevamiento no alcanza el umbral correspondiente, devuelve
`INSUFFICIENT_SIGNALS` y producción mantiene el estado vacío honesto.

## Persistencia y compatibilidad

- `NewsletterEdition.articles` se conserva para todas las ediciones existentes.
- `BriefItem` normaliza noticias y publicaciones nuevas.
- `BriefSource` y `SocialAccount` reemplazan a `localStorage` como fuente real.
- `controlio:my-circle:v1` se migra una sola vez, sin duplicar. La copia local
  sólo se elimina cuando la transacción termina correctamente.
- La migración SQL aditiva es
  `prisma/manual-migrations/010-mi-brief-platform.sql`.

## Pruebas

- Unitarias: `npm test`.
- Mobile E2E: `npm run test:e2e:brief`.

Los proyectos de Playwright cubren 320×568, 360×640, 360×800, 375×667,
390×844, 393×852, 412×915, 430×932 y una vista horizontal 844×390. La ruta de
fixture devuelve 404 salvo que `BRIEF_E2E_FIXTURE=1`.
