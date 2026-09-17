<div align="center">

# UIP Student Assistant

<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=20&pause=1200&color=0F766E&center=true&vCenter=true&width=820&lines=Automatizaci%C3%B3n+de+encuestas+Feedback+en+Moodle+UIP;Selecciona+materia+%E2%86%92+m%C3%B3dulos+%E2%86%92+valoraci%C3%B3n;Edge+%2B+Chrome+%7C+Manifest+V3;Procesamiento+local+%7C+Sin+credenciales+almacenadas" alt="UIP Student Assistant" />
</a>

<br>

<img src="https://img.shields.io/badge/version-0.5.0-0F766E?style=flat-square" alt="Versión 0.5.0" />
<img src="https://img.shields.io/badge/estado-beta-D29922?style=flat-square" alt="Beta" />
<img src="https://img.shields.io/badge/Manifest-V3-111827?style=flat-square&logo=googlechrome&logoColor=white" alt="Manifest V3" />
<img src="https://img.shields.io/badge/Edge-compatible-111827?style=flat-square&logo=microsoftedge&logoColor=0AA0F4" alt="Microsoft Edge" />
<img src="https://img.shields.io/badge/Chrome-compatible-111827?style=flat-square&logo=googlechrome&logoColor=4285F4" alt="Google Chrome" />
<img src="https://img.shields.io/badge/license-MIT-111827?style=flat-square" alt="MIT License" />

<br><br>

**Extensión de navegador para procesar encuestas Feedback disponibles en Moodle UIP desde una sola interfaz.**

</div>

---

## Qué hace

UIP Student Assistant detecta las materias disponibles en Moodle, carga sus módulos y permite iniciar un recorrido automático sobre los Feedback compatibles.

El flujo normal es:

```text
Abrir la extensión
      ↓
Seleccionar materia
      ↓
Seleccionar módulos
      ↓
Elegir valoración
      ↓
Confirmar una vez
      ↓
Procesamiento automático
      ↓
Resumen por módulo
```

Durante el recorrido la extensión puede:

- descubrir materias y módulos desde Moodle;
- detectar actividades Feedback por su URL real de Moodle;
- conservar respuestas que ya estaban seleccionadas;
- aplicar la valoración elegida únicamente en preguntas compatibles;
- verificar el formulario antes de enviarlo;
- comprobar que Moodle confirmó el envío;
- continuar con la siguiente encuesta o módulo;
- omitir módulos que Moodle indique como no disponibles;
- pausar de forma segura cuando una situación necesita revisión manual.

No es necesario abrir previamente el Área personal, una materia o un módulo. La extensión utiliza una pestaña de Moodle dedicada para el recorrido.

---

## Instalación

La extensión se instala actualmente de forma manual.

### Microsoft Edge

1. Descarga el repositorio mediante **Code → Download ZIP**.
2. Extrae el ZIP.
3. Abre `edge://extensions`.
4. Activa **Modo para desarrolladores**.
5. Pulsa **Cargar descomprimida**.
6. Selecciona la carpeta `extension/` del proyecto.
7. Opcionalmente, fija **UIP Student Assistant** en la barra del navegador.

### Google Chrome

El procedimiento es el mismo utilizando `chrome://extensions`.

> Las instrucciones ampliadas están en [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

---

## Uso

1. Inicia sesión normalmente en `https://moodle.uip.edu.pa/`.
2. Abre **UIP Student Assistant** desde el menú de extensiones.
3. Espera a que se carguen las materias.
4. Selecciona la materia que quieres procesar.
5. Marca los módulos deseados.
6. Elige una valoración.
7. Pulsa **Procesar N módulos**.
8. Revisa el resumen y pulsa **Ejecutar recorrido**.

A partir de ese momento el dashboard muestra el módulo actual, la encuesta detectada, el progreso y cualquier incidencia que requiera atención.

### Valoraciones compatibles

La extensión trabaja con las opciones observadas en los Feedback de UIP:

- Excelente
- Muy Bueno
- Bueno
- Satisfactorio
- Puede mejorar

La valoración seleccionada no reemplaza respuestas existentes.

---

## Privacidad y seguridad

UIP Student Assistant utiliza la sesión de Moodle que ya está iniciada en el navegador.

No solicita ni almacena:

- usuario o contraseña;
- cookies;
- `sesskey`;
- tokens de autenticación;
- HTML completo de Moodle;
- contenido completo de formularios;
- información en un servidor externo.

El estado temporal del recorrido se mantiene con `chrome.storage.session` y los permisos del navegador se limitan a `https://moodle.uip.edu.pa/*`.

La extensión valida nuevamente la página y los controles antes de ejecutar acciones sensibles como enviar un Feedback o continuar después de un envío.

Consulta [`docs/SECURITY.md`](docs/SECURITY.md) para más información.

---

## Compatibilidad

- Microsoft Edge basado en Chromium.
- Google Chrome.
- Manifest V3.
- Moodle UIP en `moodle.uip.edu.pa`.

La versión actual se mantiene en **beta** porque la estructura de Moodle puede variar entre materias, configuraciones y cuentas. Cuando una página no puede verificarse con seguridad, la extensión evita asumir el resultado y puede dejar el módulo para revisión.

---

## Licencia

Este proyecto se distribuye bajo la [MIT License](LICENSE).

Copyright © 2026 Euris J. Rodríguez V.

---

## Aviso

UIP Student Assistant es un proyecto independiente. No está afiliado, patrocinado ni mantenido por la Universidad Interamericana de Panamá ni por Moodle.

<div align="center">

Desarrollado por [**3UR12**](https://github.com/3UR12)

</div>
