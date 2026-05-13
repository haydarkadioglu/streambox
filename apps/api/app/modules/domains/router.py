import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DomainRule, DomainRuleType, User
from app.db.session import get_db
from app.modules.auth.router import get_current_user

router = APIRouter(prefix="/domains", tags=["domains"])


class DomainRuleIn(BaseModel):
    domain: str
    rule_type: DomainRuleType

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, value: str) -> str:
        return value.lower().strip().replace("https://", "").replace("http://", "").strip("/")


class DomainRuleOut(BaseModel):
    id: uuid.UUID
    domain: str
    rule_type: DomainRuleType
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("", response_model=list[DomainRuleOut])
def list_rules(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[DomainRuleOut]:
    return list(db.scalars(select(DomainRule).order_by(DomainRule.domain)).all())


@router.post("", response_model=DomainRuleOut)
def create_rule(
    payload: DomainRuleIn,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DomainRuleOut:
    existing = db.scalar(select(DomainRule).where(DomainRule.domain == payload.domain))
    if existing:
        existing.rule_type = payload.rule_type
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing
    rule = DomainRule(domain=payload.domain, rule_type=payload.rule_type)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
def delete_rule(
    rule_id: uuid.UUID,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    rule = db.get(DomainRule, str(rule_id))
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
