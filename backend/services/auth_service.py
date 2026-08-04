import os
import logging
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from backend.services.database import query, execute, execute_returning

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
ACCESS_EXPIRE_MINUTES = 15
REFRESH_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=REFRESH_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        return None


def authenticate_user(email: str, password: str) -> dict | None:
    rows = query(
        "SELECT id, email, role, full_name, password_hash, is_active FROM users WHERE email = %s",
        (email.lower().strip(),),
    )
    if not rows:
        return None

    user = rows[0]
    if not user["is_active"]:
        return None
    if not verify_password(password, user["password_hash"]):
        return None

    execute(
        "UPDATE users SET last_login = %s WHERE id = %s",
        (datetime.now(timezone.utc), user["id"]),
    )

    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user.get("full_name"),
    }


def create_user(email: str, password: str, full_name: str = None, role: str = "viewer") -> dict | None:
    return execute_returning(
        """INSERT INTO users (email, password_hash, full_name, role)
           VALUES (%s, %s, %s, %s) RETURNING id, email, role, full_name, is_active, created_at""",
        (email.lower().strip(), hash_password(password), full_name, role),
    )


def get_user_by_id(user_id: int) -> dict | None:
    rows = query(
        "SELECT id, email, role, full_name, is_active, created_at, last_login FROM users WHERE id = %s",
        (user_id,),
    )
    return rows[0] if rows else None


def list_users() -> list[dict]:
    return query(
        "SELECT id, email, role, full_name, is_active, created_at, last_login FROM users ORDER BY id"
    )


def update_user(user_id: int, **kwargs) -> bool:
    allowed = {"role", "full_name", "is_active"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return False

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [user_id]
    rows = execute(f"UPDATE users SET {set_clause} WHERE id = %s", tuple(values))
    return rows > 0
