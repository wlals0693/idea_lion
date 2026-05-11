from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("Profile", back_populates="user", uselist=False)
    analysis_records = relationship("AnalysisRecord", back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    status = Column(String(100), nullable=True)
    major = Column(String(255), nullable=True)

    interest_fields = Column(JSON, default=list)
    goal_activities = Column(JSON, default=list)
    capabilities = Column(JSON, default=list)
    experience_types = Column(JSON, default=list)

    experiences = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    posting_title = Column(String(255), nullable=False)
    posting_type = Column(String(100), nullable=True)
    posting_text = Column(Text, nullable=True)

    total_score = Column(Integer, nullable=True)
    result_json = Column(JSON, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="analysis_records")