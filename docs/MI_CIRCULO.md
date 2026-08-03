# Mi Círculo

Documento de diseño y estado. Define qué es la sección, por qué existe y cómo
se sostiene en el producto. La implementación vive en
`app/(dashboard)/newsletter/` y se complementa con `docs/MI_BRIEF.md`.

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

## La recompensa

Esto **no** es una app que renuncia a la dopamina: es una app que la dispara en
otro lado. La maquinaria puede ser la misma que la de Instagram; lo que cambia
es **qué la enciende**.

En Instagram la recompensa dispara **al consumir** — scrolleás, aparece algo,
hit. Por eso su óptimo es infinito. Acá dispara al **convertir** (una lectura se
volvió tarea, hábito o nota), al **declarar una conversación real**, al **cerrar
la ración** y al **podar una fuente**. Todos actos con fondo: no se pueden
repetir sin límite en un día.

**Regla dura:** nunca se premia cantidad leída, minutos adentro, días seguidos
abriendo la app, ni cantidad de contactos o de fuentes. El día que se premie
consumo, esto es Instagram con mejor contenido. La lista viva de qué cuenta como
acto está en `lib/db/circle-acts.ts`.

### Las dos capas

- **Fabricada** — la maquinaria: celebración al convertir, racha, anticipación,
  el cierre premiado. Va *en el momento*, sobre actos acotados.
- **Reflejada** — el espejo: conversaciones que ocurrieron, hábitos que siguen
  en pie, fuentes que se ganaron el lugar. Va *en el acumulado* y no se fabrica:
  cada línea es algo que la persona hizo.

Sola, la fabricada es un casino: el hit se siente y no queda nada. Solo, el
espejo es una planilla verdadera que nadie abre. Van juntas.

### El andamio se retira, y se anuncia

La capa fabricada es un **andamio, no un cimiento**. El día 1 no hay nada real
que reflejar, así que la maquinaria carga sola las primeras semanas; al tercer
mes baja el volumen y al sexto se retira, porque para entonces el acumulado
pesa más que cualquier animación.

Y se dice en voz alta: *"ya no te necesito para engancharte, mirá lo que
juntaste"*. Eso sólo se puede decir si **el contrato estuvo desde el minuto
cero** — anunciado recién al final, se lee como que la app te abandona. La
dosis y los textos viven en `lib/circle-scaffold.ts`.

### Para quién

Para alguien dispuesto a hacer el trabajo. El filtro es de **compromiso, nunca
de confusión**: pedirle clasificar cuatrocientas cuentas es exigente a
propósito, pero cada paso tiene que estar clarísimo. La fricción que no es una
prueba de voluntad es una fuga con excusa.

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

- La lista puede crecer; el límite sano está en la **cadencia**, no en la
  cantidad de personas. Cincuenta contactos con frecuencia de ocho semanas
  piden menos de una charla por día.
- Por persona: nombre, teléfono, cadencia deseada (cada 1, 2, 4, 8 o 12 semanas),
  última vez que hablaron y una nota corta sobre *la persona* — "le prometí el
  contacto del pintor" — nunca sobre la frecuencia.
- La vista diaria muestra **una o dos personas como máximo**. Nunca una lista de
  deudas sociales: la culpa produce abandono.
- La acción es un link `wa.me/<telefono>`. No requiere API de nadie.

**Restricción dura:** Control.io no ve las conversaciones del usuario con
terceros y nunca va a verlas. La integración de WhatsApp es usuario ↔ bot. Por lo
tanto el contacto **se declara, no se detecta**: con un tap en la app, o
declarándoselo al agente de WhatsApp (por ejemplo, “ya hablé con Mateo”). Que
sea un acto voluntario es mejor filosóficamente que la telemetría pasiva.

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

La app tiene que poder decir **"hoy no hay nada que valga tu tiempo"**, y lo
dice en el inicio, en el aviso diario y en Radar. Por eso la racha cuenta actos
por semana y no días abiertos: un día honesto no puede costarte una racha.

Radar sólo deja entrar lo que toca alguno de tus frentes. Era la única parte de
la sección que ofrecía contenido no elegido, sin destino — la puerta de atrás
por donde se colaba el feed.

Mejor tres piezas verificadas que doce de relleno. Esto es un límite duro: si la
curaduría es mediocre, la premisa entera ("acá la información vale más") se cae.

### La Cosecha

Consumir sin convertir es entretenimiento. Cada pieza tiene que poder volverse,
en un tap, algo que ya vive en esta misma app: una tarea, un hábito o una nota
guardada contra un frente de El Norte. `Goal` es una meta financiera, por eso no
se fuerza una pieza editorial dentro de ese modelo.

Mi Círculo es la capa de entrada; hábitos y metas son la de salida. Un lector
suelto no tiene eso, e Instagram tampoco.

Y el cierre mensual del loop, **la poda**: "Leíste 74 piezas, 9 se convirtieron
en algo. Estas 3 fuentes te dieron todas las conversiones. Estas 5 no te dieron
ninguna en 60 días — ¿las sacamos?". Las fuentes se ganan el lugar. Mientras
todos los algoritmos expanden tu feed, este lo achica.

## El Espejo — el día 1

Antes de sacar nada, ver qué hay. Instagram permite descargar tus propios datos
(Centro de cuentas → *Descargar tu información*), y el export incluye
`following.json` con todas las cuentas que seguís. Es un export legítimo,
iniciado por el usuario, sobre datos propios: no es scraping y no viola términos.

El usuario lo pide, le llega por mail y lo sube a Control.io. La app lista las
cuentas y le pide clasificar cada una en tres cubetas:

- **Persona que quiero** → va a Círculo Cercano
- **Referente del que aprendo** → va a Referentes
- **Ruido** → no va a ningún lado

**Esto es la puerta de entrada de la sección, no una etapa de La Mudanza.**
Estuvo enterrado como "etapa 0" de un proceso opcional y era exactamente al
revés, porque hace dos trabajos que ningún otro lugar puede hacer:

1. **Es la evidencia.** Le muestra a la persona algo sobre su propia vida que
   nunca vio — sigue a 412 cuentas y las que de verdad le importan son once.
   No es una promesa de marketing y no cuesta nada, porque es verdad. Es lo que
   convierte a alguien común en alguien dispuesto.
2. **Es la línea de base.** Ese "412" es imposible de reconstruir después. Sin
   él, el espejo del mes 6 queda en números absolutos, que no prueban un cambio.
   Los items del inventario no se borran nunca por esa razón (`getBaseline`).

Además ordena el setup: clasificar **ya crea** el contacto o la fuente, así que
los pasos siguientes dejan de ser "cargá catorce referentes a mano" y pasan a
ser "confirmá lo que ya clasificaste". El Norte va último, porque después de ver
tu propia lista sabés mejor qué querés.

*Caveats:* el export tarda en llegar (de horas a un día) y el formato lo define
Meta, así que puede cambiar. La carga manual queda siempre como alternativa y
como respaldo.

## La Mudanza

La transición desde Instagram, para el que quiera darla. **Desinstalar es una
decisión del usuario, no un requisito de la sección.**

**Principio rector: un hábito no se saca, se reemplaza.** Cada cosa que se quita
se sustituye *antes*. Cortar primero falla siempre.

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

## El recorrido

**Minuto 0 · El contrato.** La app declara que va a engancharte a propósito y
que la meta es dejar de hacerlo.
**Día 1 · El Espejo.** La evidencia sobre su propia vida, antes de haberle dado
nada. Acá se decide si esta persona quiere esto — y las dos respuestas son
buenos resultados.
**Mes 1–2 · El andamio.** La maquinaria fabricada carga sola: conversión
celebrada, cierre premiado, poda que se siente bien, anticipación honesta.
**Mes 3–6 · El retiro declarado.** La maquinaria baja el volumen y la app lo
dice en voz alta, mostrando el antes y después contra la línea de base.

## Estado

Todo lo anterior está implementado detrás de dos flags en `testers`:
`circuloCercanos` (la mitad gente) y `circuloSistema` (Espejo, Referentes,
Norte, Cosecha y Mudanza). Las tres migraciones están aplicadas. El perfil real
de prueba tiene acceso a ambos flags.

### Motores puros (con tests)

| Archivo | Qué decide |
| --- | --- |
| `lib/circle-cadence.ts` | Quién aparece hoy y cuánto pide la lista. Fija la regla del límite. |
| `lib/circle-north.ts` | De frentes a términos de búsqueda, y a qué frente sirve cada pieza. |
| `lib/circle-inventory.ts` | Lectura del export de Instagram, avance del inventario y checklist del corte. |
| `lib/circle-scaffold.ts` | Cuánta maquinaria corresponde hoy, qué dice la app de sí misma y la racha honesta. |
| `lib/circle-mirror.ts` | El antes y después. Nunca inventa una línea: sin material, dice que todavía no. |
| `lib/brief/feed-parser.ts` | RSS y Atom sin dependencias. Ante la duda descarta, no inventa. |

### Servicios

| Archivo | Qué hace |
| --- | --- |
| `lib/services/brief/channels.ts` | Resuelve una URL a su feed (YouTube, podcast de Apple, RSS declarado, rutas habituales). Incluye la guarda de SSRF. |
| `lib/services/brief/sources.ts` | Trae lo de los canales a la edición y escribe la razón de inclusión por frente. |

### Datos

`lib/db/circle.ts`, `circle-north.ts`, `circle-harvest.ts`, `circle-migration.ts`,
`circle-acts.ts` y `channels.ts`. Todo lo personal —nombres, teléfonos, notas,
frentes, intenciones del puente, y qué salió de cada conversación— va cifrado
con `lib/crypto.ts`.

`circle-acts.ts` es el único lugar donde se define qué cuenta como acto valioso.
Si alguna vez entra ahí una métrica de consumo, la premisa se cayó.

### Interfaz

`EspejoView`, `CercanosView`, `ReferentesView`, `NorteView`, `CosechaView` y
`MudanzaView`, bajo `app/(dashboard)/newsletter/`. Los componentes compartidos
de la capa de recompensa —`RewardBurst`, `MirrorPanel`, `StreakChip`,
`ScaffoldContract`— viven en `CircleUI.tsx`, para que ningún acto pueda
celebrarse por su cuenta.

El aviso diario sale del cron horario (`lib/services/newsletter.ts`) y **abre
por la persona que espera, no por el contenido** — y sale igual en un día sin
noticias, porque el día que la app tiene menos contenido es justo el día en que
no puede quedarse callada.

### Lo que falta

- **Falta el recorrido visual con la sesión real del usuario.** El entorno de
  prueba (`/circle-fixture`) cubre los estados con datos realistas, pero la
  validación de tono —sobre todo si Cercanos se siente humano o como un CRM, y
  si la celebración al convertir se siente ganada o barata— sólo ocurre usándolo.
- **Falta calibrar la dosis del andamio.** Los cortes de 3 y 6 meses son una
  decisión de diseño, no un dato medido.
- La extensión de escritorio (`browser-extension/controlio-focus`) y su ruta
  siguen existiendo, pero **ya no se ofrecen desde Mi Círculo**: para el
  referente sin canal propio está el puente. Queda decidir si se retira del todo.

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
