# Guía de Despliegue en Producción de PRETSO

Este documento explica cómo desplegar la plataforma PRETSO (Frontend y Backend) en los entornos de producción de Google Cloud Platform (GCP) y Firebase.

---

## 1. Despliegue del Frontend (Firebase Hosting)

El frontend está configurado para compilarse en una Single Page Application (SPA) y servirse mediante Firebase Hosting.

### Pasos para el Despliegue
1. Navega al directorio del frontend:
   ```bash
   cd frontend
   ```
2. Realiza la compilación del paquete de distribución de producción:
   ```bash
   npm run build
   ```
   * Esto generará los archivos optimizados (HTML, JS, CSS y activos) en la carpeta `frontend/dist`.
3. Desde el directorio raíz del proyecto (donde se ubica `firebase.json`), ejecuta el despliegue de Hosting utilizando Firebase CLI:
   ```bash
   firebase deploy --only hosting
   ```
4. El portal quedará disponible en producción en:
   * **[https://pretso-platform.web.app](https://pretso-platform.web.app)**

---

## 2. Despliegue del Backend (Google Cloud Run)

El backend de FastAPI está empaquetado en una imagen Docker y configurado para ejecutarse de manera escalable y serverless en Google Cloud Run.

### Pasos para el Despliegue Manual con gcloud CLI
1. Asegúrate de estar autenticado en Google Cloud y haber seleccionado el proyecto correspondiente:
   ```bash
   gcloud auth login
   gcloud config set project pretso-platform
   ```
2. Compila la imagen Docker del backend en la nube utilizando Google Cloud Builds y súbela a Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/pretso-platform/pretso-backend:latest ./backend
   ```
3. Despliega la imagen compilada en Cloud Run:
   ```bash
   gcloud run deploy pretso-platform-backend \
     --image gcr.io/pretso-platform/pretso-backend:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```
4. Define las variables de entorno en Cloud Run (como la configuración del Service Account de Firebase Admin y variables personalizadas de entorno).

---

## 3. Configuración y Rutas (Proxy/Rewrite)

Firebase Hosting está configurado (`firebase.json`) para actuar como la puerta de enlace única (Reverse Proxy) del tráfico del cliente.

```json
{
  "hosting": {
    "public": "frontend/dist",
    "rewrites": [
      {
        "source": "/api/v1/**",
        "run": {
          "serviceId": "pretso-platform-backend",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

* **`/api/v1/**`**: El tráfico hacia esta ruta es redirigido de forma transparente y segura al backend de FastAPI en Cloud Run.
* **Cualquier otra ruta (`**`)**: Es manejada por el frontend (`index.html`) para permitir el enrutamiento del lado del cliente (SPA) con React Router.
