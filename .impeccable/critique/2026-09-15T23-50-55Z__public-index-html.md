---
target: pantalla de inicio, calendario, menu de mi perfil y cuenta, aspecto en dispositivos moviles y paleta de colores en modo oscuro y modo claro
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/stemen/kalarm/public/index.html"
target_fingerprint: "sha256:eb01085355729db9c58df11b8f39ca2b930f0e14b6d0ed8d107281c132c51d09"
target_path: /home/stemen/kalarm/public/index.html
timestamp: 2026-09-15T23-50-55Z
slug: public-index-html
---
# Design Critique: SubTracker Pro (public/index.html)

**Method**: dual-agent (A: f1905c5f-055a-4d9e-a9f6-4e19f90d1f14 · B: 1a2ae97a-4e7b-4e97-bc92-709be7c47c18)
**Target Evaluated**: `public/index.html` (Dashboard, Calendario, Perfil & Ajustes, Móvil, Modo Oscuro/Claro)

---

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|:---:|---|
| 1 | Visibility of System Status | 3/4 | Los contenedores `#trialAlertsBanner` y `#budgetProgressBar` están ausentes en `index.html`, omitiendo alertas críticas de pruebas por vencer y uso de presupuesto en la vista principal. |
| 2 | Match Between System & Real World | 4/4 | Metáforas impecables de finanzas personales: fechas de corte, cuotas compartidas, divisiones de amigos, formato de moneda local y enlaces de cobro a WhatsApp. |
| 3 | User Control and Freedom | 3/4 | Descarte de modales limpio (`Esc`, backdrop, X), pero marcar como pagado avanza la fecha inmediatamente sin opción de "Deshacer" (Undo) en toast. |
| 4 | Consistency and Standards | 2/4 | Implementación de Modo Claro frágil mediante selectores `!important` que filtran tokens oscuros; "Amigos" está en la barra lateral de escritorio pero relegado a un icono diminuto en móvil. |
| 5 | Error Prevention | 3/4 | Plantillas preconfiguradas y confirmación modal destructiva (`showM3Confirm`), pero botones de acción ("Pagado") anidados en tarjetas clicables provocan pulsaciones accidentales. |
| 6 | Recognition Rather Than Recall | 4/4 | Catálogo de servicios con logotipos vectoriales oficiales, chips de categorías/estados, números tabulares alineados y búsqueda en tiempo real que eliminan la memorización. |
| 7 | Flexibility and Efficiency | 3/4 | Excelente paleta de comandos (`Ctrl+K`) y alternador de cuadrícula/tabla, pero carece de selección múltiple para acciones masivas (marcar varias pagadas). |
| 8 | Aesthetic and Minimalist Design | 3/4 | Sofisticada paleta tonal Material 3 (`#d0bcff`), pero las tarjetas de suscripción sufren de sobrecarga informativa (hasta 14 elementos visuales simultáneos). |
| 9 | Error Recovery | 3/4 | Mensajes de validación claros y advertencias antes de borrar, pero los toasts de error se auto-ocultan en 3.5s sin historial accesible de fallos. |
| 10 | Help and Documentation | 3/4 | Pantalla de bienvenida estilo ClickUp bien resuelta y micro-ayudas contextuales, pero falta una guía visual de atajos de teclado (`?`). |
| **Total** | | **31/40** | **Good (77.5%) — Base sólida y profesional con mejoras prioritarias de arquitectura y ergonomía** |

---

### Design Specificity Verdict

**Veredicto: Altamente específico para el producto (Diseño de autor genuino)**

- **Evaluación de Diseño**: SubTracker Pro no es una plantilla genérica SaaS. La interfaz resuelve problemas tangibles y propios de la gestión de suscripciones:
  - Alertas de urgencia en periodos de prueba gratuitos ("Vence en 2 días" vs "¡Cancela Hoy!").
  - Conversión multimoneda instantánea con desglose aproximado (`$20 USD ≈ $80,000 COP`).
  - Cobro compartido con amigos mediante generación directa de mensajes formateados para WhatsApp (`wa.me`).
  - Modo privacidad (*Privacy Blur*) para ocultar balances en lugares públicos.
- **Evidencia Determinista (Detector CLI)**:
  - **0 Errores / 0 Advertencias de diseño**: Ausencia total de gradientes de texto, pestañas laterales toscas, tarjetas anidadas y curvas elásticas.
  - **92 Avisos Documentados**: 84 colores de marca de presets oficiales (Spotify, Netflix, Steam, Discord) y 8 tamaños de micro-fuentes intencionales.

---

### Overall Impression

SubTracker Pro posee un nivel estético sobresaliente dentro del paradigma Google Material Design 3 en modo oscuro. La tipografía tabular verticalmente alineada, el contraste tonal equilibrado y los flujos de cálculo aportan gran tranquilidad visual. No obstante, presenta 3 tensiones fundamentales: saturación de información en las tarjetas del dashboard, una implementación frágil de modo claro que depende de selectores forzados, y una adaptación móvil que comprime elementos de escritorio (como el calendario de 7 columnas y botones menores a 44px).

---

### What's Working

1. **Jerarquía Tonal M3 Pura**: Uso ejemplar de las capas de superficie (`surface-container-low` `#1d1b20` → `surface-container` `#211f26` → `surface-container-highest` `#36343b`), evitando fondos negros puros deslumbrantes y ofreciendo sombras tonales suaves.
2. **Escaneabilidad Financiera y Privacidad**: Cifras tabulares monoespaciadas (`tnum 1`) perfectamente encolumnadas en la vista en tabla y tarjetas, combinadas con el botón de ocultamiento de privacidad.
3. **Flujo de Split Pay & WhatsApp**: Integración práctica que soluciona la fricción social de cobrarle a amigos con un solo clic.

---

### Priority Issues (P0–P3)

- **[P1] Falta del contenedor del Banner de Pruebas Gratuitas (`#trialAlertsBanner`)**:
  - *Problema*: `public/app.js` tiene la lógica de alerta de corte inminente de pruebas gratuitas, pero el contenedor `<div id="trialAlertsBanner">` no existe en `public/index.html`.
  - *Impacto*: Los usuarios no ven la alerta destacada de pruebas que están a punto de convertirse en cobros bancarios reales.
  - *Solución*: Insertar `<div id="trialAlertsBanner" class="hidden mb-4 ..."></div>` antes del listado de suscripciones en `public/index.html`.
  - *Comando sugerido*: `/impeccable layout`

- **[P1] Arquitectura Frágil de Modo Claro y Contraste Comprometido**:
  - *Problema*: `public/index.html` utiliza clases oscuras fijas de Tailwind (`bg-[#141218]`, `text-[#e6e0e9]`), obligando a `styles.css` a usar decenas de anulaciones `!important`. Componentes inyectados dinámicamente (badges, iconos oficiales, chips) filtran estilos oscuros provocando contrastes deficientes (1.4:1).
  - *Impacto*: Dificultad severa de lectura en ambientes iluminados o exteriores.
  - *Solución*: Centralizar tokens mediante variables CSS nativas (`var(--md-sys-color-surface-container)`) que conmuten limpiamente entre tema oscuro y claro.
  - *Comando sugerido*: `/impeccable colorize`

- **[P1] Ergonomía Táctil Móvil y Colisión de Acciones en Tarjetas**:
  - *Problema*: El botón "Pagado" (~24px de alto), filtros (~26px) y botones de vista (~28px) están por debajo del estándar ergonómico de 44×44px. Además, ubicar el botón "Pagado" dentro de una tarjeta clicable genera pulsaciones erróneas.
  - *Impacto*: Frustración al intentar marcar pagos o inspeccionar detalles desde el teléfono con una sola mano.
  - *Solución*: Ampliar áreas de toque a `min-h-[44px]`, separar la barra de acciones inferior de la tarjeta y exigir confirmación visual.
  - *Comando sugerido*: `/impeccable adapt`

- **[P2] Saturación del Calendario en Pantallas Móviles**:
  - *Problema*: El calendario mensual mantiene 7 columnas fijas en teléfonos móviles (~45px por celda), cortando nombres y badges de texto.
  - *Impacto*: Dificulta identificar cobros futuros sin tocar cada día individualmente.
  - *Solución*: En móviles (`< 640px`), mostrar puntos cromáticos indicadores en los días de corte y expandir automáticamente la agenda del día seleccionado debajo.
  - *Comando sugerido*: `/impeccable layout`

- **[P2] Sobrecarga Informativa en Tarjetas de Suscripción**:
  - *Problema*: Cada tarjeta muestra hasta 14 datos a la vez (logo, alias, estado, precio, ciclo, cuota, equivalente diario, fecha, barra de progreso, método de pago, amigos, notas, botón de pago).
  - *Impacto*: Fatiga visual y dificultad para el escaneo rápido.
  - *Solución*: Aplicar divulgación progresiva: mostrar los 4 datos clave en la tarjeta y reservar datos secundarios (equivalente diario, método de pago, notas) al modal de detalle.
  - *Comando sugerido*: `/impeccable distill`

---

### Persona Red Flags

- **Alex (Power User / Eficiencia)**:
  - Sin operaciones en lote: Para marcar 6 servicios como pagados a principio de mes debe hacer 6 clics individuales.
  - Falta de atajos globales: Aunque `Ctrl+K` funciona, no hay atajo para crear suscripción (`n`) ni ayuda visible de atajos (`?`).
- **Casey (Usuario Móvil con una mano / Distraído)**:
  - Objetivos de toque sub-44px generan fallos en transporte o movimiento.
  - La sección "Amigos" desapareció de la barra inferior móvil y está confinada a la cabecera superior, lejos de la zona del pulgar.
  - El calendario móvil comprime texto en celdas minúsculas.
- **Sam (Accesibilidad / Lector de pantalla y Contraste)**:
  - Micro-etiquetas (`text-[10px] text-[#cac4d0]/70` sobre fondos `#211f26`) caen por debajo de la relación de contraste 4.5:1 WCAG AA.
  - Fugas de colores oscuros en Modo Claro vuelven ilegibles badges y estados.

---

### Minor Observations

1. **Popover Huérfano en Escritorio**: Existe `#railProfilePopover` en el HTML, pero el clic en el avatar abre directamente `profileModal`, dejando ese componente inactivo.
2. **Descubrimiento del Modo Claro/Oscuro**: El interruptor de tema está enterrado en Ajustes → General; no hay acceso rápido desde la cabecera ni la barra lateral.
3. **Toast flotante en HTML estático**: `#toast` tiene `bottom-6` en el HTML inicial, lo que en móviles solapa la barra de navegación antes de que JavaScript lo ajuste.

---

### Questions to Consider

1. ¿Deberíamos convertir el calendario en móviles en una vista de agenda/lista cronológica en lugar de comprimir las 7 columnas del mes?
2. ¿Preferirías mover el cambio de Modo Oscuro / Modo Claro a un botón directo en la cabecera superior para facilitar su alternancia inmediata?
3. ¿Deseas simplificar las tarjetas del dashboard aplicando divulgación progresiva (mostrando 4 datos esenciales y delegando los detalles secundarios al modal de resumen)?
