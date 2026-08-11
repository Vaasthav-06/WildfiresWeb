from fastapi import APIRouter, HTTPException, Depends, status
from backend.schemas.auth_schemas import LoginRequest, RefreshRequest, TokenResponse, UserCreate, UserOut
from backend.services.auth_service import (
    authenticate_user, create_access_token, create_refresh_token,
    decode_token, create_user, list_users, update_user, get_user_by_id,
)
from backend.middleware.auth_middleware import get_current_user, require_admin
from backend.services.database import is_available

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _check_db():
    if not is_available():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not available")


@router.post("/login")
def login(req: LoginRequest):
    _check_db()
    user = authenticate_user(req.email, req.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access_token = create_access_token(user["id"], user["role"])
    refresh_token = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut(
            id=user["id"], email=user["email"], role=user["role"],
            full_name=user.get("full_name"), is_active=user["is_active"],
            created_at=user["created_at"], last_login=user.get("last_login"),
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(req: RefreshRequest):
    _check_db()
    payload = decode_token(req.refresh_token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = int(payload.get("sub", 0))
    user = get_user_by_id(user_id)
    if user is None or not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access_token = create_access_token(user_id, user["role"])
    refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut(
            id=user["id"], email=user["email"], role=user["role"],
            full_name=user.get("full_name"), is_active=user["is_active"],
            created_at=user.get("created_at"), last_login=user.get("last_login"),
        ),
    )


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return UserOut(
        id=user["id"], email=user["email"], role=user["role"],
        full_name=user.get("full_name"), is_active=user["is_active"],
        created_at=user.get("created_at"), last_login=user.get("last_login"),
    )


@router.post("/users", response_model=UserOut)
def add_user(req: UserCreate, _: dict = Depends(require_admin)):
    _check_db()
    rows = list_users()
    if any(u["email"] == req.email.lower().strip() for u in rows):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = create_user(req.email, req.password, req.full_name, req.role)
    if user is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

    return UserOut(
        id=user["id"], email=user["email"], role=user["role"],
        full_name=user.get("full_name"), is_active=user["is_active"],
        created_at=user.get("created_at"), last_login=user.get("last_login"),
    )


@router.get("/users", response_model=list[UserOut])
def get_users(_: dict = Depends(require_admin)):
    _check_db()
    users = list_users()
    return [
        UserOut(id=u["id"], email=u["email"], role=u["role"],
                full_name=u.get("full_name"), is_active=u["is_active"],
                created_at=u.get("created_at"), last_login=u.get("last_login"))
        for u in users
    ]


@router.put("/users/{user_id}", response_model=UserOut)
def edit_user(user_id: int, body: dict, _: dict = Depends(require_admin)):
    _check_db()
    ok = update_user(user_id, **body)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    u = get_user_by_id(user_id)
    return UserOut(
        id=u["id"], email=u["email"], role=u["role"],
        full_name=u.get("full_name"), is_active=u["is_active"],
        created_at=u.get("created_at"), last_login=u.get("last_login"),
    )
