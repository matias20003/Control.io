# Mi Círculo

Documento de diseño. Define qué es la sección, por qué existe y en qué orden se
construye. No describe código todavía: lo que hay implementado hoy vive en
`app/(dashboard)/newsletter/` y `docs/MI_BRIEF.md`.

## Premisa

Instagram es útil y por eso es difícil de soltar: ahí está la vida de la gente
que querés y la obra de los referentes que te forman. Pero el negocio de una red
social es la retención, no tu tiempo. Mi Círculo va en contra de eso.

El usuario objetivo es una persona comprometida con su propio crecimiento, que
cuida el tiempo que pasa en redes. Para esa persona, Mi Círculo no es "una red
social con menos calorías": es el lugar donde la información tiene que
justificarse contra un destino.

**La métrica está invertida.** Instagram muestra tiempo, likes y seguidores. Mi
Círculo muestra tiempo devuelto, cuántas fuentes tenés (que ese número baje es un
logro) y qué se convirtió en acción. Los números buenos son los chicos.

**Anti-adicción no es anti-uso.** El patrón que buscamos es alta frecuencia, baja
duración, valor alto: cinco minutos todos los días. Una visita corta, diaria e
imprescindible. Si en algún momento alguien propone "contenido relacionado" o
scroll infinito, la respuesta es no.

## Las dos mitades

Instagram resuelve dos necesidades distintas con la misma pantalla. Mi Círculo
las separa, porque tienen soluciones opuestas.

La sección se llama **Mi Círculo**. Sus dos mitades son **Cercanos** (la gente) y
**Referentes** (la obra).

### Cercanos — la gente que querés

La necesidad real no es *ver* a esa persona: es no perder el vínculo. Instagram
es pésimo para eso — ves una fracción de lo que postean tus afectos, enterrada
entre publicidad. Mirar una historia de 15 segundos es una simulación de vínculo.

Círculo Cercano no tiene contenido. No hay posteos, ni fotos, ni estados. Hay
nombres, cuánto hace que no hablás y un tap que abre la conversación.

- Lista **finita**: 15 personas sugeridas, 20 como tope duro. El límite es parte
  del producto, no una limitación técnica.
- Por persona: nombre, teléfono, cadencia deseada (cada 1, 2, 4, 8 o 12 semanas),
  última vez que hablaron y una nota corta sobre *la persona* — "le prometí el
  contacto del pintor" — nunca sobre la frecuencia.
- La vista diaria muestra **una o dos personas como máximo**. Nunca una lista de
  deudas sociales: la culpa produce abandono.
- La acción es un link `wa.me/<telefono>`. No requiere API de nadie.

**Restricción dura:** Control.io no ve las conversaciones del usuario con
terceros y nunca va a verlas. La integración de WhatsApp es usuario ↔ bot. Por lo
tanto el contacto **se declara, no se detecta**: con un tap en la app, o
respondiéndole al agente de WhatsApp cuando pregunta. Que sea un acto voluntario
es mejor filosóficamente que la telemetría pasiva.

**Riesgo de diseño a vigilar:** esto puede sentirse como un CRM de amigos, frío e
instrumental. Se mitiga con volumen bajo, tono humano y notas sobre la persona.

### Referentes — la obra de la que aprendés

De un referente no te importa la persona: te importa lo que produce. Y lo que
produce casi nunca vive en Instagram — vive en su newsletter, su canal, su
podcast, su blog. Instagram es donde los encontrás, no donde está la sustancia.

Entonces al agregar un referente no se pide el `@`, se pregunta **dónde publica
lo que te sirve**. La app resuelve el canal a partir de una URL: RSS/Atom,
YouTube, podcast, newsletter por mail, blog. Todos son canales abiertos, con
feeds estables, que no se rompen cuando Meta cambia algo.

Los que no tienen canal propio quedan marcados como huérfanos y son los únicos
candidatos al puente (ver abajo).

## Las capas que atraviesan todo

### El Norte

Hoy la configuración tiene `topics` y `priorityTopics`: temas sueltos, fríos. Lo
que falta es que el usuario declare **quién quiere ser** en 6 o 12 meses, en dos
o tres frentes concretos. No como adorno motivacional: como el parámetro real de
filtrado de noticias, referentes y Radar. Los temas se derivan del Norte, no al
revés.

Cada pieza de la edición muestra por qué está ahí, atada a un frente. El campo
`BriefItem.inclusionReason` ya existe y hoy está desaprovechado.

Se revisa cada tres meses.

### La Ración

La edición es un objeto finito y se ve que lo es: "9 piezas, 6 minutos, y
termina". Cuando terminás, **Mi Círculo se cierra hasta la próxima ventana**. No
hay "seguí explorando": la pantalla dice que ya leíste lo de hoy y no queda nada
que tocar. No hay scroll infinito porque no hay nada que scrollear.

La app tiene que poder decir **"hoy no hay nada que valga tu tiempo"**. Radar ya
lo hace con `INSUFFICIENT_SIGNALS`; se extiende a toda la sección.

Mejor tres piezas verificadas que doce de relleno. Esto es un límite duro: si la
curaduría es mediocre, la premisa entera ("acá la información vale más") se cae.

### La Cosecha

Consumir sin convertir es entretenimiento. Cada pieza tiene que poder volverse,
en un tap, algo que ya vive en esta misma app: una tarea, un hábito, una nota en
una meta, un movimiento. Los modelos `Task`, `Habit` y `Goal` ya existen.

Mi Círculo es la capa de entrada; hábitos y metas son la de salida. Un lector
suelto no tiene eso, e Instagram tampoco.

Y el cierre mensual del loop, **la poda**: "Leíste 74 piezas, 9 se convirtieron
en algo. Estas 3 fuentes te dieron todas las conversiones. Estas 5 no te dieron
ninguna en 60 días — ¿las sacamos?". Las fuentes se ganan el lugar. Mientras
todos los algoritmos expanden tu feed, este lo achica.

## La Mudanza

La transición desde Instagram. Sin esto, el día 1 el usuario tiene Mi Círculo
vacío e Instagram lleno, y no hay competencia posible.

**Principio rector: un hábito no se saca, se reemplaza.** Cada cosa que se quita
se sustituye *antes*. Cortar primero falla siempre.

### Etapa 0 · El inventario

Antes de sacar nada, ver qué hay. Instagram permite descargar tus propios datos
(Centro de cuentas → *Descargar tu información*), y el export incluye
`following.json` con todas las cuentas que seguís. Es un export legítimo,
iniciado por el usuario, sobre datos propios: no es scraping y no viola términos.

El usuario lo pide, le llega por mail y lo sube a Control.io. La app lista las
cuentas y le pide clasificar cada una en tres cubetas:

- **Persona que quiero** → va a Círculo Cercano
- **Referente del que aprendo** → va a Referentes
- **Ruido** → no va a ningún lado

Ese acto de clasificar ya es la mitad del valor de la sección. Nadie lo hizo
nunca conscientemente.

*Caveats:* el export tarda en llegar (de horas a un día) y el formato lo define
Meta, así que puede cambiar. La carga manual queda siempre como alternativa y
como respaldo.

### Etapa 1 · El reemplazo

Por cada referente clasificado, la app busca su canal propio. Por cada persona,
se pide el teléfono. Una barra de cobertura muestra el avance real:

> 9 de 14 referentes ya viven en Control.io.

### Etapa 2 · La convivencia

Dos o tres semanas con Instagram todavía instalado y Mi Círculo corriendo en
paralelo. Sin prohibiciones: es una prueba. Durante esta etapa el gancho diario
no puede ser el contenido — ahí Instagram gana siempre. El gancho es Círculo
Cercano ("hoy: Mateo") y que la edición sea corta y termine. El aviso llega por
WhatsApp, que es donde el usuario ya está.

### Etapa 3 · El corte

Un ritual explícito, con checklist previo: ¿tenés los teléfonos de tus personas?
¿tus referentes tienen canal propio? Recién ahí, desinstalar.

Y una salida honesta, sin culpa: si la volvés a instalar no pasa nada, volvés
acá. Un producto que castiga la recaída se desinstala él.

### Etapa 4 · La vida después

Días sin Instagram, sí, pero sobre todo el sustituto: tiempo devuelto,
conversaciones reales que ocurrieron, piezas que se convirtieron en algo.

Así, desinstalar deja de ser un sacrificio que le pedimos al usuario y pasa a ser
la consecuencia natural de que ya no le hace falta.

## El puente

Para el residuo: el referente que solo publica en Instagram y no tiene otro
canal. Se entra por navegador a ese perfil puntual, con un marco: antes se
escribe a qué vas, después la app pregunta qué encontraste.

**Control.io no puede encarcelar a Instagram desde afuera y no lo vamos a
disimular.** El navegador ya es peor que la app —sin notificaciones, sin push,
sin el gesto automático de abrirla— y esa fricción juega a favor.

Lo importante es que la excepción **se vea y tenga costo**: "3 de tus 14
referentes te obligan a entrar a Instagram". Ese número tiene que incomodar y
tender a bajar. Cuando uno de esos abre un canal propio, la app avisa y se migra.

## Lo que no vamos a hacer

- **Traer contenido de perfiles ajenos de Instagram.** No hay forma legítima: la
  Basic Display API está discontinuada y la actual sólo da tu propia cuenta. Lo
  único que queda son proveedores de scraping: se rompen seguido, se pagan por
  llamada, violan los términos de Meta y exponen legalmente al producto. El hook
  `SOCIAL_CONTENT_PROVIDER_URL` puede seguir existiendo como enchufe opcional,
  pero **no puede ser el cimiento de la sección**.
- Recomendar automáticamente a quién seguir. `BriefSource` es explícito por
  diseño y así se queda.
- Contenido relacionado, scroll infinito o cualquier mecánica de sesión larga.

## Orden de construcción

1. **Círculo Cercano.** No depende de ninguna API externa, es el diferencial más
   fuerte y se puede lanzar solo. Incluye alta manual de personas.
2. **Referentes por obra.** Resolución de canales legítimos, más El Norte y La
   Cosecha sobre la edición que ya existe.
3. **La Mudanza.** Import del export de Instagram, clasificación, cobertura,
   convivencia y corte. Va después de 1 y 2 porque necesita destinos donde
   clasificar.
4. **El puente.** Último y a propósito: si existe desde el arranque, nadie migra
   sus fuentes.

## Estado

Las cuatro fases están implementadas y desplegadas, detrás de dos flags en
`testers`: `circuloCercanos` (la mitad gente) y `circuloSistema` (Referentes,
Norte, Cosecha y Mudanza). Las dos migraciones están aplicadas.

### Motores puros (con tests)

| Archivo | Qué decide |
| --- | --- |
| `lib/circle-cadence.ts` | Quién aparece hoy y cuánto pide la lista. Fija la regla del límite. |
| `lib/circle-north.ts` | De frentes a términos de búsqueda, y a qué frente sirve cada pieza. |
| `lib/circle-inventory.ts` | Lectura del export de Instagram, avance del inventario y checklist del corte. |
| `lib/brief/feed-parser.ts` | RSS y Atom sin dependencias. Ante la duda descarta, no inventa. |

### Servicios

| Archivo | Qué hace |
| --- | --- |
| `lib/services/brief/channels.ts` | Resuelve una URL a su feed (YouTube, podcast de Apple, RSS declarado, rutas habituales). Incluye la guarda de SSRF. |
| `lib/services/brief/sources.ts` | Trae lo de los canales a la edición y escribe la razón de inclusión por frente. |

### Datos

`lib/db/circle.ts`, `circle-north.ts`, `circle-harvest.ts`, `circle-migration.ts`
y `channels.ts`. Todo lo personal —nombres, teléfonos, notas, frentes,
intenciones del puente— va cifrado con `lib/crypto.ts`.

### Interfaz

`CercanosView`, `ReferentesView`, `NorteView`, `CosechaView` y `MudanzaView`,
bajo `app/(dashboard)/newsletter/`. La navegación separa lo diario (Cercanos,
Referentes, Noticias, Radar) de lo periódico (Norte, Cosecha, Mudanza).

### Lo que falta

- **Nada de esto se ejercitó en el navegador con sesión iniciada.** Está
  verificado por tests, tipos, lint y build, y el esquema fue comprobado contra
  la base real — pero el recorrido de la interfaz no.
- El registro de conversaciones por WhatsApp: hoy Cercanos sólo se declara
  desde la app.
- La vieja ventana enfocada de Instagram (extensión de escritorio) sigue viva y
  accesible, ahora en la fila secundaria. Convive con el puente; en algún
  momento hay que decidir si se retira.

## Restricciones que atraviesan todo

- Control.io no ve las conversaciones del usuario con terceros. Todo contacto
  cercano es declarado.
- No hay API legítima para leer perfiles ajenos de Instagram.
- Los datos de Círculo Cercano son información personal de terceros (nombres,
  teléfonos): se cifran con `lib/crypto.ts`, igual que los nombres de hábitos.
- En mobile no existe forma técnica de imponer una ventana de tiempo sobre
  Instagram. La extensión `browser-extension/controlio-focus` es de escritorio y
  hoy está limitada a una cuenta (`app/api/my-brief/focus-extension/route.ts`).
- Mejor una edición corta y verificada que una larga con relleno.
