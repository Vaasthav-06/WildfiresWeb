from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    role: str = "viewer"


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class ZoneCreate(BaseModel):
    name: str
    type: str
    state: Optional[str] = None
    district: Optional[str] = None
    area_ha: Optional[float] = None
    metadata: dict = {}
    geojson: Optional[dict] = None


class ZoneOut(BaseModel):
    id: int
    name: str
    type: str
    state: Optional[str]
    district: Optional[str]
    area_ha: Optional[float]
    metadata: dict
    created_at: datetime

    class Config:
        from_attributes = True
