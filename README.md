# El Archivo - Sistema de Gestion Multimedia

Sistema para gestionar un catalogo de series, peliculas, anime, manga y manhwa con PostgreSQL.

## Requisitos

- Node.js 16 o superior
- PostgreSQL instalado y corriendo
- pgAdmin opcional para administrar la base
- npm

## Configuracion

1. Copia `.env.example` como `.env` si no existe.
2. Ajusta tus credenciales de PostgreSQL en `.env`.
3. Instala dependencias:

```bash
npm install
```

4. Inicia el servidor:

```bash
npm start
```

Al iniciar, el servidor intenta crear automaticamente la base `el_archivo` y las tablas necesarias.

La app queda disponible en `http://localhost:3000`.

## Crear la base manualmente en pgAdmin

Si prefieres hacerlo manual:

1. En pgAdmin crea una base llamada `el_archivo`.
2. Abre el Query Tool dentro de esa base.
3. Ejecuta el contenido de `database.sql`.

## Variables de entorno

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_contrasena
DB_NAME=el_archivo
PORT=3000
```

## API

- `GET /api/catalog`: obtiene el catalogo.
- `POST /api/catalog`: guarda el catalogo completo usando transaccion.
- `GET /api/covers`: obtiene portadas.
- `POST /api/covers`: guarda portadas.
