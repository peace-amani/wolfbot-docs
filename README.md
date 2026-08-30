# WolfBot Docs

A minimal, responsive documentation site for WolfBot with a private content desk for publishing images, uploaded videos, and YouTube references.

## Run locally

```bash
npm install
copy .env.example .env
npm start
```

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a long random `SESSION_SECRET` before using the admin area. Open `/` for the docs and select **Admin** to sign in.

## Content management

- `POST /api/admin/login` authenticates the administrator with an HttpOnly cookie.
- `POST /api/admin/media` accepts a multipart image/video upload or a YouTube URL.
- `GET /api/media` returns published media for the public gallery.
- `DELETE /api/admin/media/:id` removes a media item and its local file.

Media metadata is stored in `data/media.json`; uploaded files are stored in `uploads/`. Both paths are ignored by Git. For production, place the site behind HTTPS, use a strong secret, add persistent storage for `data/` and `uploads/`, and consider moving media to object storage.

## Design

The interface uses a restrained green, black, and neutral palette with no glow effects. Light mode is the default; the theme toggle persists the visitor’s choice in local storage. The layout is intentionally content-first and responsive on small screens.
