import jwt
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

# Cargar configuración segura desde el archivo .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_secret")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Instancia de seguridad para forzar un Bearer Token en los headers
security = HTTPBearer()

def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Middleware de Seguridad Cero-Confianza (Zero Trust).
    Verifica que el token enviado en el header Authorization sea matemáticamente válido.
    Bloquea accesos no autorizados a nuestro Motor de Decisión.
    """
    token = credentials.credentials
    try:
        # Decodificar el token usando nuestra llave secreta
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Validación extra: Asegurar que quien llama es explícitamente nuestro API Gateway Node.js
        if payload.get("service") != "vitalroute_gateway":
            raise HTTPException(status_code=403, detail="Ciberseguridad: Servicio no autorizado para consumir el Motor de Decisión")
            
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Seguridad: El Token ha expirado por tiempo de vida útil.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Seguridad: Token manipulado o inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )
