# CELD – Campus Equipment Lending Desk

## 1. Descripción del proyecto

**Campus Equipment Lending Desk (CELD)** es un sistema diseñado para facilitar la consulta del catálogo de equipos disponibles para préstamo dentro de una institución universitaria.

El sistema permite a los usuarios visualizar los equipos registrados, buscar artículos por nombre, filtrar por categoría y consultar información detallada de cada equipo, incluyendo su código de activo, descripción y disponibilidad actual.

Este proyecto se desarrolla como parte del curso **COMP3402 – Software Engineering II**.

## 2. Alcance del módulo desarrollado

Este módulo se concentra en la funcionalidad de consulta del catálogo de equipos, correspondiente al caso de uso **UC-001: Find Equipment**.

Las funcionalidades implementadas son:

- Visualización del catálogo de equipos.
- Obtención de los equipos mediante una solicitud a la API.
- Búsqueda de equipos por nombre.
- Búsqueda sin distinción entre letras mayúsculas y minúsculas.
- Filtrado de equipos por categoría.
- Combinación de búsqueda por nombre y filtrado por categoría.
- Visualización de información individual de cada equipo.
- Consulta de código de activo, categoría, descripción y disponibilidad.
- Mensaje cuando no existen equipos que coincidan con los criterios de búsqueda.
- Manejo de errores cuando no se puede obtener información del servidor.
- Indicador de carga mientras se obtiene el catálogo.

El módulo está preparado para integrarse posteriormente con los demás componentes desarrollados por el equipo.

## 3. Tecnologías utilizadas

### Frontend

| Tecnología | Propósito |
|---|---|
| React | Construcción de la interfaz de usuario. |
| TypeScript | Tipado estático y definición de estructuras de datos. |
| Vite | Herramienta de desarrollo y compilación. |
| CSS | Diseño y estilos de la interfaz. |
| Vitest | Ejecución de pruebas automatizadas. |
| React Testing Library | Pruebas de los componentes y comportamiento de la interfaz. |
| jsdom | Simulación del entorno del navegador durante las pruebas. |

### Backend

| Tecnología | Propósito |
|---|---|
| C# | Lenguaje utilizado para el backend. |
| ASP.NET Core | Desarrollo de la API REST. |
| .NET 10 | Plataforma de ejecución del backend. |

### Herramientas de desarrollo

- Visual Studio Code.
- Node.js.
- npm.
- .NET SDK.
- Git (para control de versiones, cuando corresponda).

## 4. Arquitectura del proyecto

El proyecto utiliza una arquitectura cliente-servidor.

El frontend realiza solicitudes HTTP al backend para obtener la información del catálogo. El backend procesa las solicitudes y devuelve los datos en formato JSON.

### Flujo de comunicación

1. El usuario accede a la interfaz de CELD.
2. React solicita el catálogo al backend.
3. ASP.NET Core recibe la solicitud HTTP.
4. El backend devuelve la información de los equipos en formato JSON.
5. React procesa la respuesta y muestra los equipos.
6. El usuario puede buscar, filtrar y consultar los detalles de cada equipo.

### Estructura de carpetas

```text
CELD/
│
├── client/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   │   └── equipmentService.ts
│   │   ├── test/
│   │   │   └── setup.ts
│   │   ├── types/
│   │   │   └── equipment.ts
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.tsx
│   │
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
│
├── server/
│   └── CELD.Api/
│       ├── Program.cs
│       └── CELD.Api.csproj
│
├── docs/
│
└── README.md
```

*Nota: la estructura representa los archivos principales utilizados en el desarrollo. Pueden existir otros archivos de configuración generados automáticamente.*

## 5. Modelo de datos

Para representar los equipos del catálogo se creó una interfaz de TypeScript denominada `Equipment`.

Ubicación:

`client/src/types/equipment.ts`

```typescript
export interface Equipment {
  id: number
  assetCode: string
  name: string
  category: string
  description: string
  availability: 'Available' | 'Unavailable'
}
```

### Descripción de los atributos

| Atributo | Tipo | Descripción |
|---|---|---|
| id | number | Identificador del equipo. |
| assetCode | string | Código único del activo. |
| name | string | Nombre del equipo. |
| category | string | Categoría a la que pertenece. |
| description | string | Descripción del equipo. |
| availability | string | Estado actual de disponibilidad. |

El atributo `availability` utiliza dos valores:

- `Available`: el equipo está disponible.
- `Unavailable`: el equipo no está disponible.

Esta interfaz permite mantener una estructura consistente entre los datos recibidos desde la API y los componentes del frontend.

## 6. Backend y API

El backend fue desarrollado utilizando ASP.NET Core.

Actualmente, el servidor expone un endpoint para obtener el catálogo de equipos.

### Endpoint

| Método HTTP | Ruta | Descripción |
|---|---|---|
| GET | `/api/equipment` | Obtiene la lista de equipos. |

**URL local:**

```text
http://localhost:5133/api/equipment
```

La respuesta se devuelve en formato JSON.

Ejemplo:

```json
[
  {
    "id": 1,
    "assetCode": "DEMO-001",
    "name": "Laptop Dell",
    "category": "Computadoras",
    "description": "Laptop para uso académico.",
    "availability": "Available"
  }
]
```

### Datos de demostración

Actualmente, el backend utiliza seis registros de demostración:

| Código | Equipo | Categoría | Disponibilidad |
|---|---|---|---|
| DEMO-001 | Laptop Dell | Computadoras | Available |
| DEMO-002 | Laptop HP | Computadoras | Available |
| DEMO-003 | Mouse Logitech | Accesorios | Available |
| DEMO-004 | Teclado mecánico | Accesorios | Unavailable |
| DEMO-005 | Monitor Dell | Monitores | Available |
| DEMO-006 | Tablet Samsung | Tabletas | Available |

**Importante:** los registros actuales son datos temporales almacenados en memoria. Todavía no se ha integrado una base de datos persistente. Por lo tanto, estos datos sirven para desarrollar y probar la funcionalidad del catálogo, pero no representan todavía un sistema de almacenamiento definitivo.

## 7. Servicio de comunicación con la API

Para separar la comunicación HTTP de los componentes de React se creó un servicio denominado `equipmentService.ts`.

Ubicación:

`client/src/services/equipmentService.ts`

```typescript
import type { Equipment } from '../types/equipment'

const API_URL = 'http://localhost:5133'

export async function getEquipment(): Promise<Equipment[]> {
  const response = await fetch(`${API_URL}/api/equipment`)

  if (!response.ok) {
    throw new Error('No se pudo obtener el catálogo de equipos.')
  }

  return response.json()
}
```

### Funcionamiento

1. Se define la dirección base del backend.
2. Se realiza una solicitud HTTP mediante `fetch()`.
3. Se verifica si la respuesta fue exitosa.
4. Si ocurre un error HTTP, se genera una excepción.
5. Si la solicitud es exitosa, los datos JSON se devuelven como una lista de objetos `Equipment`.

El servicio utiliza `async/await` para manejar las operaciones asíncronas.

## 8. Funcionalidades del frontend

La interfaz fue desarrollada utilizando React y TypeScript.

### 8.1 Carga del catálogo

Cuando se inicia la aplicación, React ejecuta una solicitud al endpoint `/api/equipment`.

Se utilizan estados para controlar:

- La lista de equipos recibidos.
- El estado de carga.
- Los posibles errores.
- La búsqueda actual.
- La categoría seleccionada.
- El equipo seleccionado para consultar sus detalles.

### 8.2 Búsqueda por nombre

El usuario puede escribir el nombre de un equipo en el campo de búsqueda.

La búsqueda:

- No distingue entre mayúsculas y minúsculas.
- Permite encontrar coincidencias parciales.
- Elimina espacios innecesarios al principio y al final de la búsqueda.

### 8.3 Filtrado por categoría

La interfaz permite seleccionar una categoría para limitar los resultados.

La opción `Todas` permite visualizar nuevamente todos los equipos.

Las categorías se obtienen a partir de los datos recibidos desde la API.

### 8.4 Búsqueda combinada

La búsqueda por nombre y el filtro por categoría funcionan simultáneamente.

Por ejemplo, el usuario puede seleccionar `Computadoras` y escribir `Dell` para encontrar equipos que cumplan ambas condiciones.

### 8.5 Detalles del equipo

Al seleccionar una tarjeta del catálogo, se abre una ventana modal con información adicional.

La ventana presenta:

- Nombre del equipo.
- Código de activo.
- Categoría.
- Descripción.
- Disponibilidad actual.

La ventana puede cerrarse mediante el botón de cierre o haciendo clic fuera de ella.

También se implementaron atributos de accesibilidad para identificar el diálogo y permitir su uso mediante teclado.

### 8.6 Estados de la interfaz

La aplicación contempla diferentes situaciones:

| Estado | Comportamiento |
|---|---|
| Loading | Indica que el catálogo está cargando. |
| Error | Informa que ocurrió un problema al obtener los datos. |
| Empty | Informa que no existen resultados para la búsqueda. |
| Success | Muestra los equipos recibidos desde el servidor. |
| Details | Presenta la información del equipo seleccionado. |

## 9. Configuración y ejecución del proyecto

### Requisitos previos

Antes de ejecutar el proyecto, es necesario tener instalado:

- Node.js.
- npm.
- .NET SDK 10.
- Visual Studio Code (recomendado).

### 9.1 Ejecutar el backend

Desde la carpeta principal del proyecto, abrir una terminal y ejecutar:

```powershell
dotnet run --project server/CELD.Api
```

El servidor estará disponible localmente en:

```text
http://localhost:5133
```

Para comprobar que el endpoint funciona, abrir:

```text
http://localhost:5133/api/equipment
```

Debe aparecer una respuesta JSON con los equipos de demostración.

### 9.2 Ejecutar el frontend

Abrir una segunda terminal y entrar en la carpeta `client`:

```powershell
cd client
```

Instalar las dependencias:

```powershell
npm.cmd install
```

Iniciar el servidor de desarrollo:

```powershell
npm.cmd run dev
```

La aplicación estará disponible en:

```text
http://localhost:5173
```

**Importante:** el backend y el frontend deben estar ejecutándose simultáneamente para que el catálogo pueda obtener los datos del servidor.

## 10. Pruebas automatizadas

Para verificar el comportamiento del catálogo se configuró Vitest junto con React Testing Library y jsdom.

### Dependencias utilizadas

- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`

La configuración de pruebas se encuentra en:

`client/vite.config.ts`

El archivo de configuración inicial de las pruebas se encuentra en:

`client/src/test/setup.ts`

### Pruebas implementadas

Las pruebas se encuentran en:

`client/src/App.test.tsx`

Se implementaron ocho pruebas:

| # | Prueba | Resultado |
|---|---|---|
| 1 | Carga y muestra los equipos recibidos desde la API. | Passed |
| 2 | Busca equipos por nombre. | Passed |
| 3 | Filtra equipos por categoría. | Passed |
| 4 | Combina búsqueda y filtrado por categoría. | Passed |
| 5 | Muestra un mensaje cuando no existen coincidencias. | Passed |
| 6 | Abre y muestra los detalles de un equipo. | Passed |
| 7 | Permite cerrar la ventana de detalles. | Passed |
| 8 | Muestra un mensaje de error cuando falla la solicitud a la API. | Passed |

Las pruebas utilizan una simulación del servicio `getEquipment` para controlar las respuestas recibidas por el componente.

Esto permite comprobar el comportamiento del frontend sin depender de que el backend esté ejecutándose durante cada prueba.

### Ejecutar las pruebas

Desde la carpeta `client`:

```powershell
npm.cmd test
```

Para ejecutar las pruebas una sola vez, sin dejar Vitest en modo de observación:

```powershell
npm.cmd test -- --run
```

### Resultado obtenido

En la última ejecución:

```text
Test Files  1 passed (1)
Tests       8 passed (8)
```

Las ocho pruebas implementadas fueron aprobadas.

## 11. Verificación de calidad y compilación

Además de las pruebas automatizadas, se realizaron dos verificaciones adicionales.

### 11.1 Build de producción

Comando:

```powershell
npm.cmd run build
```

Este comando ejecuta:

```text
tsc -b && vite build
```

- TypeScript comprueba los tipos y realiza la compilación.
- Vite genera los archivos optimizados para producción.

**Resultado obtenido:**

```text
vite v8.3.6 building client environment for production...
✓ 18 modules transformed.
✓ built in 88ms
```

Se generó correctamente la carpeta:

```text
client/dist/
```

### 11.2 ESLint

Comando:

```powershell
npm.cmd run lint
```

**Resultado obtenido:**

```text
> eslint .
```

El comando terminó sin reportar errores de ESLint.

## 12. Limitaciones actuales y trabajo pendiente

La implementación actual corresponde al módulo del catálogo y todavía requiere completar algunas tareas antes de considerarse parte de la versión final del sistema.

### Limitaciones actuales

1. **Almacenamiento temporal:** los equipos están definidos en memoria en el backend.
2. **Base de datos:** todavía no se ha integrado una base de datos persistente.
3. **Datos de demostración:** los seis equipos actuales se utilizan para desarrollar y probar el catálogo.
4. **Dirección de API:** el frontend utiliza actualmente una URL local configurada directamente en el servicio.
5. **Detalles del equipo:** la ventana modal utiliza la información que ya fue recibida en la lista del catálogo; todavía no realiza una solicitud independiente para obtener los detalles.
6. **Integración del equipo:** los módulos desarrollados por los demás integrantes todavía no están integrados.

### Trabajo pendiente

- Integrar una base de datos persistente cuando se defina la solución del equipo.
- Confirmar la estructura definitiva de los endpoints con el resto del equipo.
- Revisar la integración con los módulos de los demás integrantes.
- Configurar la dirección de la API para los distintos entornos.
- Completar las pruebas de integración con el backend real.
- Verificar el comportamiento del sistema con los datos definitivos.

## 13. Estado actual del módulo

A la fecha de esta documentación, el módulo del catálogo cuenta con:

- Interfaz React + TypeScript.
- Comunicación con una API ASP.NET Core.
- Visualización de equipos.
- Búsqueda por nombre.
- Filtro por categoría.
- Búsqueda combinada.
- Ventana modal de detalles.
- Manejo de carga y errores.
- Ocho pruebas automatizadas aprobadas.
- Compilación de producción exitosa.
- ESLint sin errores.

**Estado:** módulo del catálogo implementado y verificado mediante pruebas del frontend, compilación y análisis estático. La integración definitiva con la base de datos y los demás módulos del sistema continúa pendiente.

---

## 14. Notas para integración y handoff

Este módulo se desarrolló de manera independiente para facilitar su posterior integración con el resto del sistema CELD.

El servicio `equipmentService.ts` centraliza la comunicación con el backend, mientras que `equipment.ts` define el modelo de datos utilizado por el frontend.

Los demás integrantes pueden utilizar esta estructura como referencia al conectar sus funcionalidades con el catálogo.

Antes de integrar los módulos, se recomienda coordinar:

- El modelo definitivo de equipos.
- Los nombres y rutas de los endpoints.
- La estructura de las respuestas JSON.
- La fuente de datos de disponibilidad.
- La configuración de la base de datos.
- La estrategia de ejecución conjunta del frontend y backend.

## 12. Funcionalidades y tareas pendientes

Las siguientes tareas quedan pendientes para continuar el desarrollo y completar la integración del sistema CELD.

### 12.1 Catálogo de equipos (módulo actual)

- [ ] Integrar una base de datos persistente para almacenar los equipos.
- [ ] Sustituir los datos temporales de demostración por información almacenada en la base de datos.
- [ ] Implementar o integrar un endpoint para consultar los detalles individuales de un equipo.
- [ ] Configurar la dirección de la API mediante variables de entorno.
- [ ] Realizar pruebas de integración entre React y ASP.NET Core.
- [ ] Verificar que la disponibilidad mostrada corresponda a la información actualizada del servidor.

### 12.2 Integración con los demás módulos

- [ ] Integrar el módulo de autenticación de usuarios.
- [ ] Integrar las funcionalidades de reservación de equipos.
- [ ] Integrar la cancelación de reservaciones.
- [ ] Integrar las funcionalidades del personal para gestionar la entrega (*pickup*) de equipos.
- [ ] Integrar las funcionalidades del personal para gestionar la devolución (*return*) de equipos.
- [ ] Coordinar los modelos de datos y endpoints entre los diferentes módulos.
- [ ] Verificar que los módulos puedan comunicarse correctamente.

### 12.3 Verificación y pruebas finales

- [ ] Ejecutar pruebas de integración del sistema completo.
- [ ] Verificar los permisos y comportamientos según el tipo de usuario.
- [ ] Comprobar el manejo de errores entre frontend y backend.
- [ ] Verificar la persistencia y consistencia de los datos.
- [ ] Realizar pruebas del sistema completo de acuerdo con los requisitos del SRS.
- [ ] Preparar la documentación final del proyecto.

### 12.4 Limitaciones de la implementación actual

- El catálogo utiliza actualmente seis equipos de demostración almacenados temporalmente en memoria.
- Todavía no se ha conectado una base de datos persistente.
- La consulta de detalles utiliza los datos que ya fueron recibidos al cargar el catálogo.
- Las pruebas actuales son pruebas del frontend con el servicio de API simulado; todavía no se han realizado pruebas de integración con el backend real.
- Los módulos de los demás integrantes todavía no están integrados.

**Fin de la documentación del módulo de catálogo de CELD.**