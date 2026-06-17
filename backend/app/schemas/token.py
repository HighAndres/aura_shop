from pydantic import BaseModel


class AccessToken(BaseModel):
    """Respuesta de sesión. El refresh token viaja en cookie httpOnly aparte."""

    access_token: str
    token_type: str = "bearer"
