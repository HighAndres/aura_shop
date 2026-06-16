from pydantic import BaseModel


class Token(BaseModel):
    """Par de tokens devuelto al autenticarse."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
