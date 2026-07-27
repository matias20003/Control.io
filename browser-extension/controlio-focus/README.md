# Control.io Focus

Extensión privada de Chrome para abrir el perfil elegido desde **Mi círculo** en
una ventana enfocada de hasta dos minutos.

## Qué hace

- Abre únicamente el perfil solicitado por Control.io.
- Permite entrar a sus publicaciones, historias y recorrer los reels cargados
  desde ese perfil.
- Bloquea otros perfiles, Explorar, el feed general, mensajes y búsqueda.
- Cierra la ventana cuando vence el contador o cuando se cierra el modal.
- Usa la sesión de Instagram que ya existe en Chrome.

No copia contenido, no lee ni guarda contraseñas, no solicita permisos de
cookies y no envía datos de Instagram a Control.io.

## Instalación privada

1. Descomprimí `controlio-focus.zip`. En Windows: clic derecho y
   **Extraer todo**.
2. Abrí `chrome://extensions` en Chrome.
3. Activá **Modo de desarrollador**.
4. Elegí **Cargar extensión sin empaquetar**.
5. Seleccioná la carpeta descomprimida `controlio-focus`, que contiene
   `manifest.json`.
6. Recargá `https://controlio.site/newsletter`.

Si estás trabajando directamente desde el repositorio, podés seleccionar
`browser-extension/controlio-focus` sin descargar el ZIP.

La función web solamente se muestra para `yorismatias372@gmail.com`.

## Actualización

Después de recibir una nueva versión, abrí `chrome://extensions` y presioná el
botón **Actualizar** de Control.io Focus.

## Limitaciones

Instagram cambia su interfaz con frecuencia. La navegación también se controla
por URL para conservar el bloqueo aunque cambien elementos visuales, pero puede
ser necesario ajustar selectores para mantener ocultos botones nuevos.
