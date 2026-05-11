from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str


class ProfileSave(BaseModel):
    status: Optional[str] = None
    major: Optional[str] = None
    interest_fields: List[str] = []
    goal_activities: List[str] = []
    capabilities: List[str] = []
    experience_types: List[str] = []
    experiences: Optional[str] = None


class AnalysisRecordCreate(BaseModel):
    posting_title: str
    posting_type: Optional[str] = None
    posting_text: Optional[str] = None
    total_score: Optional[int] = None
    result_json: Any


class AnalysisRecordResponse(BaseModel):
    id: int
    posting_title: str
    posting_type: Optional[str]
    total_score: Optional[int]
    result_json: Any
    created_at: datetime

    class Config:
        from_attributes = True