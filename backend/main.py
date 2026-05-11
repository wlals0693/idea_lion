from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import fitz
import os
from dotenv import load_dotenv
import google.generativeai as genai
import json
import re
import requests
from bs4 import BeautifulSoup
from sqlalchemy import text
from database import engine
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import User, Profile, AnalysisRecord
from schemas import UserCreate, UserLogin, TokenResponse, ProfileSave, AnalysisRecordCreate
from auth import hash_password, verify_password, create_access_token, decode_access_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


app = FastAPI()
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://idea-lion-front.vercel.app",],
    
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProfileRequest(BaseModel):
    status: Optional[str] = None
    major: Optional[str] = None
    interest_fields: List[str] = []
    goal_activities: List[str] = []
    capabilities: List[str] = []
    experience_types: List[str] = []
    experiences: Optional[str] = None

class PostingUrlRequest(BaseModel):
    user_id: int = 1
    url: str

class AnalysisMockRequest(BaseModel):
    user_id: int = 1
    posting_title: Optional[str] = None
    posting_type: Optional[str] = None

class AnalysisGeminiRequest(BaseModel):
    user_profile: dict
    posting_title: str
    posting_type: str
    posting_text: str

class PostingTextRequest(BaseModel):
    user_id: int = 1
    title: str
    posting_type: str
    content: str


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""

    try:
        pdf_document = fitz.open(stream=file_bytes, filetype="pdf")

        for page in pdf_document:
            text += page.get_text()

        pdf_document.close()
        return text.strip()

    except Exception as e:
        print("PDF 텍스트 추출 오류:", e)
        return ""
    
def extract_json_from_text(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", text)

    if not match:
        raise ValueError("Gemini 응답에서 JSON을 찾을 수 없습니다.")

    return json.loads(match.group())

def clamp_score(value, minimum=0, maximum=100):
    try:
        value = int(round(float(value)))
    except (TypeError, ValueError):
        value = 0

    return max(minimum, min(maximum, value))


def calculate_fit_score(user_score: int, required_score: int) -> int:
    user = clamp_score(user_score)
    required = clamp_score(required_score)

    if required <= 0:
        return min(user, 85)

    gap = user - required

    if gap >= 0:
        fit = 76 + min(gap, 20) * 0.6
    else:
        fit = 76 + gap * 1.2

    if user < required:
        fit = min(fit, 88)

    if user <= 60:
        fit = min(fit, 70)

    if user <= 70:
        fit = min(fit, 80)

    if user <= 75:
        fit = min(fit, 85)

    if user < 85:
        fit = min(fit, 90)

    if user < 90:
        fit = min(fit, 94)

    fit = min(fit, 96)

    return clamp_score(fit)

def extract_text_from_url(url: str) -> str:
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }

        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")

        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator="\n")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        cleaned_text = "\n".join(lines)

        return cleaned_text[:5000]

    except Exception as e:
        print("URL 텍스트 추출 오류:", e)
        return ""

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")

    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="토큰에 사용자 정보가 없습니다.")

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")

    return user


@app.get("/")
def root():
    return {"message": "핏체크 백엔드 서버 실행 중"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/profiles")
def save_profile(
    profile_data: ProfileSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing_profile = db.query(Profile).filter(
        Profile.user_id == current_user.id
    ).first()

    if existing_profile:
        existing_profile.status = profile_data.status
        existing_profile.major = profile_data.major
        existing_profile.interest_fields = profile_data.interest_fields
        existing_profile.goal_activities = profile_data.goal_activities
        existing_profile.capabilities = profile_data.capabilities
        existing_profile.experience_types = profile_data.experience_types
        existing_profile.experiences = profile_data.experiences

        db.commit()
        db.refresh(existing_profile)

        saved_profile = existing_profile
        message = "사용자 정보가 수정되었습니다."
    else:
        new_profile = Profile(
            user_id=current_user.id,
            status=profile_data.status,
            major=profile_data.major,
            interest_fields=profile_data.interest_fields,
            goal_activities=profile_data.goal_activities,
            capabilities=profile_data.capabilities,
            experience_types=profile_data.experience_types,
            experiences=profile_data.experiences
        )

        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)

        saved_profile = new_profile
        message = "사용자 정보가 저장되었습니다."

    return {
        "message": message,
        "profile": {
            "status": saved_profile.status,
            "major": saved_profile.major,
            "interest_fields": saved_profile.interest_fields or [],
            "goal_activities": saved_profile.goal_activities or [],
            "capabilities": saved_profile.capabilities or [],
            "experience_types": saved_profile.experience_types or [],
            "experiences": saved_profile.experiences
        }
    }

@app.get("/profiles/me")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(Profile).filter(
        Profile.user_id == current_user.id
    ).first()

    if not profile:
        return {
            "success": False,
            "message": "저장된 사용자 정보가 없습니다.",
            "profile": None
        }

    return {
        "success": True,
        "profile": {
            "status": profile.status,
            "major": profile.major,
            "interest_fields": profile.interest_fields or [],
            "goal_activities": profile.goal_activities or [],
            "capabilities": profile.capabilities or [],
            "experience_types": profile.experience_types or [],
            "experiences": profile.experiences
        }
    }

@app.post("/analysis-records")
def save_analysis_record(
    record_data: AnalysisRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_record = AnalysisRecord(
        user_id=current_user.id,
        posting_title=record_data.posting_title,
        posting_type=record_data.posting_type,
        posting_text=record_data.posting_text,
        total_score=record_data.total_score,
        result_json=record_data.result_json
    )

    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    return {
        "success": True,
        "message": "분석 결과가 저장되었습니다.",
        "record": {
            "id": new_record.id,
            "posting_title": new_record.posting_title,
            "posting_type": new_record.posting_type,
            "total_score": new_record.total_score,
            "created_at": new_record.created_at,
            "result_json": new_record.result_json
        }
    }

@app.get("/analysis-records")
def get_analysis_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    records = (
        db.query(AnalysisRecord)
        .filter(AnalysisRecord.user_id == current_user.id)
        .order_by(AnalysisRecord.created_at.desc())
        .all()
    )

    return {
        "success": True,
        "records": [
            {
                "id": record.id,
                "posting_title": record.posting_title,
                "posting_type": record.posting_type,
                "total_score": record.total_score,
                "created_at": record.created_at,
                "result_json": record.result_json
            }
            for record in records
        ]
    }

@app.get("/analysis-records/{record_id}")
def get_analysis_record_detail(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = (
        db.query(AnalysisRecord)
        .filter(
            AnalysisRecord.id == record_id,
            AnalysisRecord.user_id == current_user.id
        )
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="분석 기록을 찾을 수 없습니다.")

    return {
        "success": True,
        "record": {
            "id": record.id,
            "posting_title": record.posting_title,
            "posting_type": record.posting_type,
            "posting_text": record.posting_text,
            "total_score": record.total_score,
            "created_at": record.created_at,
            "result_json": record.result_json
        }
    }

@app.post("/postings/url")
def create_posting_by_url(posting: PostingUrlRequest):
    if not posting.url.startswith("http"):
        return {
            "success": False,
            "message": "올바른 URL 형식이 아닙니다.",
            "fallback_required": True
        }

    extracted_text = extract_text_from_url(posting.url)

    if len(extracted_text.strip()) < 50:
        return {
            "success": False,
            "message": "URL에서 공고 내용을 충분히 가져오지 못했습니다. 로그인 필요 페이지이거나 외부 접근이 제한된 페이지일 수 있습니다. PDF/텍스트 입력을 사용해주세요.",
            "fallback_required": True
        }

    return {
        "success": True,
        "message": "URL에서 공고 텍스트를 추출했습니다.",
        "posting": {
            "user_id": posting.user_id,
            "input_type": "url",
            "url": posting.url,
            "title": "URL 공고 분석",
            "posting_type": "공고 URL",
            "raw_text": extracted_text
        }
    }

@app.post("/analysis/mock")
def create_mock_analysis(request: AnalysisMockRequest):
    capability_score = 78
    experience_score = 74
    growth_score = 90
    schedule_score = 72

    total_score = round(
        capability_score * 0.40
        + experience_score * 0.30
        + growth_score * 0.15
        + schedule_score * 0.15
    )

    return {
        "success": True,
        "analysis": {
            "posting_title": request.posting_title or "화이트햇 스쿨 교육생 모집",
            "posting_type": request.posting_type or "학습 지원 프로그램",
            "total_score": total_score,
            "confidence": "보통",
            "summary": "기초 역량과 성장 방향은 잘 맞지만, 지원 전 포트폴리오 정리가 필요합니다.",
            "scores": {
                "capability": {
                    "title": "기초 역량 적합도",
                    "score": capability_score,
                    "positive_factors": ["Python 기초", "Linux 사용 경험", "네트워크 기초 지식"],
                    "weak_factors": ["보안 심화 경험 부족", "포트폴리오 정리 필요"]
                },
                "experience": {
                    "title": "활동 경험 적합도",
                    "score": experience_score,
                    "positive_factors": ["보안 동아리 활동", "CTF 참여 경험", "팀 프로젝트 경험"],
                    "weak_factors": ["대외 수상 경험 부족", "운영 경험 부족"]
                },
                "growth": {
                    "title": "성장 방향 적합도",
                    "score": growth_score,
                    "positive_factors": ["보안 분야 관심", "네트워크 진로 목표", "실습형 프로그램 선호"],
                    "weak_factors": ["장기 목표를 자기소개서에 더 명확히 작성 필요"]
                },
                "schedule": {
                    "title": "준비 일정 적합도",
                    "score": schedule_score,
                    "positive_factors": ["마감까지 14일", "예상 준비 7~10일", "포트폴리오 정리 권장"],
                    "weak_factors": ["제출 서류 초안 작성 필요", "마감 3일 전까지 정리 필요"]
                }
            },
            "recommendation": {
                "status": "지원 전 보완 권장",
                "priority_actions": [
                    "자기소개서에 보안 동아리 경험 정리",
                    "CTF 참여 경험을 문제 해결 사례로 작성",
                    "포트폴리오에 Linux/네트워크 실습 내용 추가",
                    "마감 3일 전까지 제출 서류 초안 완성"
                ]
            }
        }
    }

@app.post("/analysis/gemini")
def create_gemini_analysis(
    request: AnalysisGeminiRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not GEMINI_API_KEY:
        return {
            "success": False,
            "message": "GEMINI_API_KEY가 설정되지 않았습니다."
        }

    prompt = f"""
너는 공모전, 대외활동, 학습 지원 프로그램, 부트캠프, 해커톤, 서포터즈, 멘토링, 교육 프로그램 등 다양한 활동 모집 공고를 분석하는 AI다.

너의 역할은 합격 여부를 예측하는 것이 아니다.
너의 역할은 입력된 프로필이 현재 이 활동에 지원하거나 참여하기에 어느 정도 준비되어 있는지 현실적으로 판단하는 것이다.

절대 원칙:
- 점수를 후하게 주지 마라.
- 관련성이 있다는 이유만으로 높은 점수를 주지 마라.
- 100점은 거의 사용하지 마라.
- 단순 관심, 전공 일치, 동아리 활동만으로 90점 이상을 주지 마라.
- 사용자 정보에 명시된 내용만 근거로 삼아라.
- 명시되지 않은 역량, 포트폴리오, 수상, 프로젝트 결과물, 실무 경험은 있다고 추정하지 마라.
- 공고 요구사항과 입력된 프로필 사이에 부족한 부분이 있으면 반드시 weak_factors에 적어라.
- 점수와 판단 근거가 서로 모순되면 안 된다.
- positive_factors가 있어도 weak_factors가 있으면 점수를 보수적으로 줘라.

분석 대상:
공고명: {request.posting_title}
공고 유형: {request.posting_type}

공고 내용:
{request.posting_text}

입력된 프로필:
{json.dumps(request.user_profile, ensure_ascii=False)}

평가 항목:
1. capability
- 기초 역량
- 활동 수행에 필요한 전공, 기초 지식, 기술, 도구 활용 능력, 학습 경험을 평가한다.
- IT/개발, 보안/네트워크, 디자인, 교육/멘토링, 마케팅/콘텐츠, 기획/창업, 봉사/사회문제 등 공고 분야에 맞게 판단한다.

2. experience
- 활동 경험
- 프로젝트, 동아리, 스터디, 공모전, 대외활동, 봉사, 멘토링, 해커톤, 서포터즈 등 실제 활동 이력을 평가한다.
- 단순 관심과 실제 경험을 반드시 구분한다.
- 경험의 구체성, 역할, 결과물, 성과가 있는지 확인한다.

3. growth
- 성장 방향
- 공고의 분야, 활동 목적, 학습 방향이 입력된 관심 분야와 목표 활동에 얼마나 연결되는지 평가한다.
- 성장 방향은 다른 항목보다 높을 수 있지만, 단순 관심 일치만으로 95점 이상을 주지 마라.

4. schedule
- 준비 일정
- 마감일, 자기소개서, 포트폴리오, 제출 서류, 사전 과제, 면접, 활동 준비 부담을 평가한다.
- 제출물의 현재 준비 상태가 입력되어 있지 않으면 보수적으로 평가한다.

required_scores 기준:
- 공고가 요구하는 수준이다.
- 낮은 점수는 쉬운 공고, 높은 점수는 까다로운 공고를 의미한다.

required_scores 점수 기준:
- 0~30: 누구나 신청 가능한 단순 참여형 활동
- 31~50: 관심 분야 기초 이해가 있으면 가능한 활동
- 51~70: 관련 기초 역량이나 경험이 어느 정도 필요한 활동
- 71~85: 자기소개서, 포트폴리오, 면접, 사전 과제, 선발 과정이 있는 활동
- 86~100: BoB, 화이트햇 스쿨, 고난도 부트캠프, 전국 규모 공모전, 전문성이 강하게 요구되는 활동

user_scores 기준:
- 입력된 프로필이 현재 갖춘 준비도다.
- 사용자가 가진 역량과 경험을 공고 요구사항과 비교해서 판단한다.
- 입력된 정보에 없는 내용은 점수에 반영하지 않는다.

user_scores 점수 기준:
- 0~20: 관련 정보가 거의 없음
- 21~40: 관심은 있으나 구체적인 역량이나 경험이 부족함
- 41~60: 기초 지식, 간단한 학습 경험, 관련 관심 분야가 있음
- 61~75: 관련 활동 경험이 있고 어느 정도 연결성이 있음
- 76~85: 관련 활동, 프로젝트, 역할, 결과물이 비교적 구체적임
- 86~90: 관련 포트폴리오, 프로젝트 결과물, 성과가 명확함
- 91~100: 수상, 실무 수준 결과물, 고도화된 프로젝트, 매우 강한 성과가 명확할 때만 사용

강제 점수 제한 규칙:
- 수상, 실무 경험, 완성 프로젝트, 포트폴리오, 구체적 성과가 없으면 user_scores는 90 이상을 주지 마라.
- 단순히 전공이 관련 있다고 해서 capability를 85 이상 주지 마라.
- 단순히 관심 분야가 일치한다고 해서 growth를 95 이상 주지 마라.
- 단순 동아리 활동, 스터디, CTF 참여 경험만 있으면 experience는 보통 60~75 범위에서 평가해라.
- 구체적인 역할, 결과물, 성과가 없으면 experience는 80 이상을 주지 마라.
- 자기소개서, 포트폴리오, 제출 서류 준비 상태가 명확하지 않으면 schedule은 75 이하로 평가해라.
- 마감일이 충분히 남아 있어도 제출물 준비 상태가 불명확하면 schedule을 85 이상 주지 마라.
- 공고가 선발형 교육 프로그램, 보안 캠프, 부트캠프, 해커톤, 전문 교육 과정이면 required_scores를 낮게 잡지 마라.
- 보완 요소가 존재하면 해당 항목 user_score는 90 이상이 될 수 없다.
- weak_factors가 있는 항목은 user_score를 90 이상 주지 마라.

점수 예시:
- 정보보호학과 + Linux/Python + CTF 스터디 경험만 있는 경우:
  - 보안 캠프 capability user_score는 보통 65~78
  - 보안 캠프 experience user_score는 보통 60~75
  - 보안 분야 growth user_score는 보통 80~90
  - 자기소개서/포트폴리오 준비 상태가 불명확하면 schedule user_score는 보통 60~75
- 포트폴리오, 수상, 프로젝트 결과물, 리더 경험, 실무형 성과가 명확히 적혀 있을 때만 80점 이상을 적극 고려한다.
- 현재 정보가 부족하면 높은 가능성보다 부족한 정보와 보완 방향을 우선 제시한다.

summary 작성 규칙:
- 전체 분석 요약은 한 문장으로 작성한다.
- 너무 긍정적으로 포장하지 말고, 강점과 보완점을 함께 말한다.
- 예: "보안 분야 관심과 기초 경험은 공고와 잘 맞지만, 구체적인 프로젝트 결과물과 제출 서류 준비 상태는 보완이 필요합니다."

recommendation_status 선택 기준:
- 지금 지원 가능: 대부분 요구사항을 충족하고, 보완 요소가 작을 때
- 지원 전 보완 권장: 지원은 가능하지만 자기소개서, 포트폴리오, 경험 정리 등 보완이 필요할 때
- 준비 기간 확보 필요: 마감 전 준비해야 할 항목이 많거나 제출물 준비 상태가 불명확할 때
- 기초 역량 보완 우선: 공고 요구 수준에 비해 기초 역량이나 경험이 부족할 때

문장 표현 규칙:
- 결과 문장에서는 "사용자"라는 표현을 되도록 사용하지 마라.
- "지원자", "입력된 프로필", "현재 정보", "보유 역량", "전공과 경험" 같은 표현을 사용해라.
- 서비스 화면에 바로 표시될 문장이므로 자연스럽고 이해하기 쉽게 작성해라.

중요:
- 너는 최종 total_score를 계산하지 않는다.
- 너는 required_scores와 user_scores를 현실적으로 산정한다.
- 항목별 최종 적합도와 total_score는 백엔드 코드가 별도로 계산한다.
- user_score가 required_score보다 조금 높다고 해서 완벽한 적합도를 의미하지 않는다.
- required_score와 user_score는 비교용 점수일 뿐이며, 둘 다 근거 중심으로 보수적으로 산정한다.

응답 규칙:
- 반드시 순수 JSON만 반환해라.
- 마크다운 코드블록을 사용하지 마라.
- JSON 앞뒤에 설명 문장을 붙이지 마라.
- 모든 점수는 0~100 사이의 정수로 작성해라.
- 배열에는 화면에 바로 표시할 수 있는 짧은 한국어 문장을 넣어라.
- 점수와 근거가 서로 모순되면 안 된다.

아래 JSON 형식으로만 응답해라.

{{
  "posting_summary": {{
    "title": "공고명",
    "posting_type": "공고 유형",
    "field": "공고 분야",
    "difficulty_level": "낮음/보통/높음/매우 높음",
    "difficulty_score": 0,
    "deadline": "마감일을 알 수 없으면 null",
    "estimated_preparation_days": 0,
    "confidence": "낮음/보통/높음"
  }},
  "required_scores": {{
    "capability": 0,
    "experience": 0,
    "growth": 0,
    "schedule": 0
  }},
  "user_scores": {{
    "capability": 0,
    "experience": 0,
    "growth": 0,
    "schedule": 0
  }},
  "positive_factors": {{
    "capability": [],
    "experience": [],
    "growth": [],
    "schedule": []
  }},
  "weak_factors": {{
    "capability": [],
    "experience": [],
    "growth": [],
    "schedule": []
  }},
  "score_reasons": {{
    "capability": "기초 역량 점수 판단 근거",
    "experience": "활동 경험 점수 판단 근거",
    "growth": "성장 방향 점수 판단 근거",
    "schedule": "준비 일정 점수 판단 근거"
  }},
  "summary": "전체 분석 요약 한 문장",
  "recommendation_status": "지금 지원 가능/지원 전 보완 권장/준비 기간 확보 필요/기초 역량 보완 우선",
  "priority_actions": []
}}
"""

    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        response = model.generate_content(prompt)

        gemini_data = extract_json_from_text(response.text)

        required = gemini_data["required_scores"]
        user = gemini_data["user_scores"]

        weak_factors = gemini_data.get("weak_factors", {})

        required = {
            "capability": clamp_score(required.get("capability", 0)),
            "experience": clamp_score(required.get("experience", 0)),
            "growth": clamp_score(required.get("growth", 0)),
            "schedule": clamp_score(required.get("schedule", 0)),
        }

        user = {
            "capability": clamp_score(user.get("capability", 0)),
            "experience": clamp_score(user.get("experience", 0)),
            "growth": clamp_score(user.get("growth", 0)),
            "schedule": clamp_score(user.get("schedule", 0)),
        }

        # Gemini가 지나치게 후하게 준 사용자 준비도 점수를 백엔드에서 한 번 더 제한
        if weak_factors.get("capability") and user["capability"] > 85:
            user["capability"] = 85

        if weak_factors.get("experience") and user["experience"] > 78:
            user["experience"] = 78

        if weak_factors.get("growth") and user["growth"] > 90:
            user["growth"] = 90

        if weak_factors.get("schedule") and user["schedule"] > 75:
            user["schedule"] = 75

        # 구체적 성과가 없는 일반적인 활동 경험은 너무 높게 보지 않음
        if user["experience"] > 85 and weak_factors.get("experience"):
            user["experience"] = 80

        # 제출물 준비 상태가 불명확한 경우 일정 점수 과대평가 방지
        if user["schedule"] > 85 and weak_factors.get("schedule"):
            user["schedule"] = 75

        capability_fit = calculate_fit_score(user["capability"], required["capability"])
        experience_fit = calculate_fit_score(user["experience"], required["experience"])
        growth_fit = calculate_fit_score(user["growth"], required["growth"])
        schedule_fit = calculate_fit_score(user["schedule"], required["schedule"])

        total_score = round(
            capability_fit * 0.40
            + experience_fit * 0.30
            + growth_fit * 0.15
            + schedule_fit * 0.15
        )

        posting_summary = gemini_data["posting_summary"]
        score_reasons = gemini_data.get("score_reasons", {})

        analysis = {
            "posting_title": posting_summary["title"],
            "posting_type": posting_summary["posting_type"],
            "field": posting_summary.get("field", "분야 미분류"),
            "difficulty_level": posting_summary["difficulty_level"],
            "difficulty_score": posting_summary["difficulty_score"],
            "deadline": posting_summary["deadline"],
            "estimated_preparation_days": posting_summary["estimated_preparation_days"],
            "total_score": total_score,
            "confidence": posting_summary.get("confidence", "보통"),
            "summary": gemini_data["summary"],
            "scores": {
                "capability": {
                    "title": "기초 역량 적합도",
                    "score": capability_fit,
                    "required_score": required["capability"],
                    "user_score": user["capability"],
                    "reason": score_reasons.get("capability", ""),
                    "positive_factors": gemini_data["positive_factors"]["capability"],
                    "weak_factors": gemini_data["weak_factors"]["capability"]
                },
                "experience": {
                    "title": "활동 경험 적합도",
                    "score": experience_fit,
                    "required_score": required["experience"],
                    "user_score": user["experience"],
                    "reason": score_reasons.get("experience", ""),
                    "positive_factors": gemini_data["positive_factors"]["experience"],
                    "weak_factors": gemini_data["weak_factors"]["experience"]
                },
                "growth": {
                    "title": "성장 방향 적합도",
                    "score": growth_fit,
                    "required_score": required["growth"],
                    "user_score": user["growth"],
                    "reason": score_reasons.get("growth", ""),
                    "positive_factors": gemini_data["positive_factors"]["growth"],
                    "weak_factors": gemini_data["weak_factors"]["growth"]
                },
                "schedule": {
                    "title": "준비 일정 적합도",
                    "score": schedule_fit,
                    "required_score": required["schedule"],
                    "user_score": user["schedule"],
                    "reason": score_reasons.get("schedule", ""),
                    "positive_factors": gemini_data["positive_factors"]["schedule"],
                    "weak_factors": gemini_data["weak_factors"]["schedule"]
                }
            },
            "recommendation": {
                "status": gemini_data["recommendation_status"],
                "priority_actions": gemini_data["priority_actions"]
            }
        }

        new_record = AnalysisRecord(
            user_id=current_user.id,
            posting_title=analysis["posting_title"],
            posting_type=analysis["posting_type"],
            posting_text=request.posting_text,
            total_score=analysis["total_score"],
            result_json=analysis
        )

        db.add(new_record)
        db.commit()
        db.refresh(new_record)

        return {
            "success": True,
            "message": "Gemini 분석 결과가 저장되었습니다.",
            "record_id": new_record.id,
            "analysis": analysis
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }

@app.post("/postings/text")
def create_posting_by_text(posting: PostingTextRequest):
    if len(posting.content.strip()) < 20:
        return {
            "success": False,
            "message": "공고 내용이 너무 짧습니다. 모집 대상, 활동 기간, 마감일 등이 포함된 내용을 입력해주세요.",
            "fallback_required": False
        }

    return {
        "success": True,
        "message": "공고 텍스트가 임시 저장되었습니다.",
        "posting": {
            "user_id": posting.user_id,
            "input_type": "text",
            "title": posting.title,
            "posting_type": posting.posting_type,
            "raw_text": posting.content
        }
    }

@app.post("/postings/pdf")
async def create_posting_by_pdf(
    user_id: int = Form(1),
    title: str = Form(...),
    posting_type: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.lower().endswith(".pdf"):
        return {
            "success": False,
            "message": "PDF 파일만 업로드할 수 있습니다.",
            "fallback_required": True
        }

    file_content = await file.read()
    extracted_text = extract_text_from_pdf(file_content)

    if len(extracted_text.strip()) < 20:
        return {
            "success": False,
            "message": "PDF에서 충분한 텍스트를 추출하지 못했습니다. 스캔본 PDF이거나 이미지 기반 PDF일 수 있습니다. 텍스트 직접 입력을 사용해주세요.",
            "fallback_required": True
        }

    return {
        "success": True,
        "message": "PDF 텍스트 추출에 성공했습니다.",
        "posting": {
            "user_id": user_id,
            "input_type": "pdf",
            "title": title,
            "posting_type": posting_type,
            "file_name": file.filename,
            "file_size": len(file_content),
            "extracted_text": extracted_text[:3000]
        }
    }

@app.get("/gemini/test")
def gemini_test():
    if not GEMINI_API_KEY:
        return {
            "success": False,
            "message": "GEMINI_API_KEY가 설정되지 않았습니다."
        }

    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        response = model.generate_content(
            "공모전 공고 분석 서비스에서 AI가 해야 할 일을 한 문장으로 설명해줘."
        )

        return {
            "success": True,
            "result": response.text
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }
    

@app.get("/db/test")
def db_test():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            value = result.scalar()

        return {
            "success": True,
            "message": "DB 연결 성공",
            "result": value
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }
    
@app.post("/auth/register")
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")

    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token({
        "user_id": new_user.id,
        "email": new_user.email
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": new_user.id,
        "email": new_user.email
    }


@app.post("/auth/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    access_token = create_access_token({
        "user_id": user.id,
        "email": user.email
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email
    }


@app.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email
    }