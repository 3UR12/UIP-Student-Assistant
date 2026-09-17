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

Durante el recorrido puede descubrir materias y módulos, detectar actividades Feedback, conservar respuestas existentes, aplicar la valoración elegida en preguntas compatibles, verificar el formulario antes del envío, confirmar el resultado en Moodle y continuar con el siguiente módulo.

No es necesario abrir previamente el Área personal, una materia o un módulo. La extensión utiliza una pestaña de Moodle dedicada para el recorrido.

---

## Instalación

### Microsoft Edge

1. Descarga el repositorio mediante **Code → Download ZIP**.
2. Extrae el ZIP.
3. Abre `edge://extensions`.
4. Activa **Modo para desarrolladores**.
5. Pulsa **Cargar descomprimida**.
6. Selecciona la carpeta `extension/`.
7. Opcionalmente, fija **UIP Student Assistant** en la barra del navegador.

### Google Chrome

Usa el mismo procedimiento desde `chrome://extensions`.

---

## Uso

1. Inicia sesión normalmente en `https://moodle.uip.edu.pa/`.
2. Abre **UIP Student Assistant** desde el menú de extensiones.
3. Espera a que se carguen las materias.
4. Selecciona una materia.
5. Marca los módulos deseados.
6. Elige una valoración.
7. Pulsa **Procesar N módulos**.
8. Revisa el resumen y pulsa **Ejecutar recorrido**.

Valoraciones observadas en los Feedback de UIP:

- Excelente
- Muy Bueno
- Bueno
- Satisfactorio
- Puede mejorar

La valoración seleccionada no reemplaza respuestas existentes.

---

## Privacidad y seguridad

UIP Student Assistant utiliza la sesión de Moodle ya iniciada en el navegador. No solicita ni almacena usuario, contraseña, cookies, `sesskey`, tokens de autenticación, HTML completo ni contenido completo de formularios.

El estado temporal del recorrido se mantiene en `chrome.storage.session`. Los permisos del navegador se limitan al dominio `https://moodle.uip.edu.pa/*` y a las capacidades necesarias para mantener el flujo y sus tiempos de espera.

Antes de enviar un Feedback, la extensión vuelve a validar la página, el formulario y el control de envío. Un resultado sólo se considera enviado cuando Moodle muestra evidencia posterior al submit.

---

## Compatibilidad

- Microsoft Edge basado en Chromium.
- Google Chrome.
- Manifest V3.
- Moodle UIP en `moodle.uip.edu.pa`.

La versión actual se mantiene en **beta** porque la estructura y disponibilidad de Moodle pueden variar entre materias y cuentas. Si una página no puede verificarse de forma segura, la extensión evita asumir el resultado.

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
