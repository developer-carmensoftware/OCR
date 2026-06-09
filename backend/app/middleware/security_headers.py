from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # HSTS — only effective over HTTPS; harmless over HTTP
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # CSP — backend serves only JSON/API (no HTML UI), so lock everything down.
        # Skip the Swagger/ReDoc docs pages, which legitimately load scripts/styles.
        path = request.url.path
        if not (path.startswith("/docs") or path.startswith("/redoc")):
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )
        return response
