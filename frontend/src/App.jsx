import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const scoreWeights = [
  { key: 'capability', label: '기초 역량', weight: 40 },
  { key: 'experience', label: '활동 경험', weight: 30 },
  { key: 'growth', label: '성장 방향', weight: 15 },
  { key: 'schedule', label: '준비 일정', weight: 15 },
];

const capabilityOptionsByField = {
  'IT/개발': [
    'Python',
    'JavaScript',
    'React',
    'HTML/CSS',
    'GitHub',
    '웹 개발',
    '앱 개발',
    '팀 프로젝트',
  ],
  '보안/네트워크': [
    'Linux',
    '네트워크 기초',
    'CTF',
    '웹 취약점',
    '보안 동아리',
    '보안 스터디',
    '침해 대응 기초',
    '패킷 분석',
  ],
  'AI/데이터': [
    'Python',
    '데이터 분석',
    '머신러닝 기초',
    'Pandas',
    'SQL',
    '데이터 시각화',
    'AI 모델 활용',
  ],
  디자인: [
    'Figma',
    'Photoshop',
    'Illustrator',
    'UX/UI',
    '포트폴리오',
    '프로토타입 제작',
    '카드뉴스 디자인',
  ],
  '마케팅/콘텐츠': [
    'SNS 운영',
    '콘텐츠 기획',
    '카드뉴스 제작',
    '영상 편집',
    '카피라이팅',
    '홍보 기획',
    '블로그 운영',
  ],
  '교육/멘토링': [
    '멘토링',
    '교육 봉사',
    '아동 지도',
    '청소년 지도',
    '수업 보조',
    '발표 능력',
    '상담 경험',
    '소통 능력',
  ],
  '기획/창업': [
    '서비스 기획',
    '문제 정의',
    '시장 조사',
    '사업계획서',
    '피치덱 제작',
    '발표 능력',
    '아이디어 제안',
  ],
  '봉사/사회문제': [
    '봉사활동',
    '캠페인 기획',
    '사회문제 조사',
    '현장 활동',
    '공익 콘텐츠 제작',
    '팀 활동',
    '소통 능력',
  ],
};

function App() {
  const [currentPage, setCurrentPage] = useState(
    () => localStorage.getItem('fitcheckPage') || 'home',
  );
  const [savedProfile, setSavedProfile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('fitcheckToken') || '',
  );

  const [authUser, setAuthUser] = useState(() => {
    const savedUser = localStorage.getItem('fitcheckUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const logout = () => {
    localStorage.removeItem('fitcheckToken');
    localStorage.removeItem('fitcheckUser');
    localStorage.removeItem('fitcheckPage');

    setAccessToken('');
    setAuthUser(null);
    setSavedProfile(null);
    setAnalysisResult(null);
    setCurrentPage('home');
  };

  const protectedPages = [
    'profile',
    'posting',
    'postingText',
    'history',
    'mypage',
  ];

  const movePage = (pageId) => {
    if (protectedPages.includes(pageId) && !authUser) {
      setLoginRequiredPage(pageId);
      return;
    }

    setCurrentPage(pageId);
  };

  const [loginRequiredPage, setLoginRequiredPage] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/health`).catch(() => {
      console.warn('Health check failed.');
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('fitcheckPage', currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    axios
      .get(`${API_BASE_URL}/profiles/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      .then((response) => {
        if (response.data.success && response.data.profile) {
          setSavedProfile(response.data.profile);
        }
      })
      .catch((error) => {
        console.error('프로필 불러오기 실패:', error);
      });
  }, [accessToken]);

  const renderPage = () => {
    switch (currentPage) {
      case 'profile':
        return (
          <ProfilePage
            setCurrentPage={setCurrentPage}
            setSavedProfile={setSavedProfile}
            savedProfile={savedProfile}
            accessToken={accessToken}
          />
        );
      case 'posting':
        return (
          <PostingPage
            setCurrentPage={setCurrentPage}
            setAnalysisResult={setAnalysisResult}
            savedProfile={savedProfile}
            accessToken={accessToken}
          />
        );
      case 'loading':
        return <LoadingPage setCurrentPage={setCurrentPage} />;
      case 'result':
        return (
          <ResultPage
            setCurrentPage={setCurrentPage}
            analysisResult={analysisResult}
          />
        );
      case 'history':
        return (
          <HistoryPage
            setCurrentPage={setCurrentPage}
            analysisResult={analysisResult}
            setAnalysisResult={setAnalysisResult}
            accessToken={accessToken}
          />
        );
      case 'mypage':
        return (
          <MyPage
            setCurrentPage={setCurrentPage}
            savedProfile={savedProfile}
            analysisResult={analysisResult}
          />
        );
      case 'postingText':
        return (
          <PostingTextPage
            setCurrentPage={setCurrentPage}
            setAnalysisResult={setAnalysisResult}
            savedProfile={savedProfile}
            accessToken={accessToken}
          />
        );
      case 'auth':
        return (
          <AuthPage
            setCurrentPage={setCurrentPage}
            setAccessToken={setAccessToken}
            setAuthUser={setAuthUser}
            redirectPage={loginRequiredPage || 'profile'}
            clearLoginRequiredPage={() => setLoginRequiredPage(null)}
          />
        );
      default:
        return <HomePage setCurrentPage={movePage} />;
    }
  };

  return (
    <div className="app">
      <Header
        currentPage={currentPage}
        setCurrentPage={movePage}
        authUser={authUser}
        logout={logout}
      />
      <main className="main">{renderPage()}</main>
      {loginRequiredPage && currentPage !== 'auth' && (
        <ConfirmModal
          title="로그인이 필요합니다"
          description="스펙 저장, 공고 분석, 분석 기록 확인은 로그인 후 이용할 수 있습니다."
          confirmText="로그인하기"
          cancelText="닫기"
          onConfirm={() => {
            setCurrentPage('auth');
          }}
          onCancel={() => {
            setLoginRequiredPage(null);
          }}
        />
      )}
    </div>
  );
}

function Header({ currentPage, setCurrentPage, authUser, logout }) {
  const menus = [
    { id: 'home', label: '홈' },
    { id: 'profile', label: '스펙 입력' },
    { id: 'posting', label: '공고 분석' },
    { id: 'history', label: '분석 기록' },
    { id: 'mypage', label: '마이페이지' },
  ];

  return (
    <header className="header">
      <button className="logo" onClick={() => setCurrentPage('home')}>
        <span>FitCheck</span>
      </button>

      <nav>
        {menus.map((menu) => (
          <button
            key={menu.id}
            className={currentPage === menu.id ? 'nav active' : 'nav'}
            onClick={() => setCurrentPage(menu.id)}
          >
            {menu.label}
          </button>
        ))}

        {authUser ? (
          <button className="nav auth-nav" onClick={logout}>
            로그아웃
          </button>
        ) : (
          <button
            className={currentPage === 'auth' ? 'nav active' : 'nav auth-nav'}
            onClick={() => setCurrentPage('auth')}
          >
            로그인
          </button>
        )}
      </nav>
    </header>
  );
}

function HomePage({ setCurrentPage }) {
  const steps = [
    ['01', '스펙 입력', '관심 분야와 활동 경험을 정리합니다.'],
    ['02', '공고 입력', 'URL, PDF, 텍스트 중 편한 방식으로 넣습니다.'],
    ['03', 'AI 분석', '공고 요구사항과 나의 준비도를 비교합니다.'],
    ['04', '전략 확인', '보완할 점과 다음 액션을 확인합니다.'],
  ];

  return (
    <section className="page home">
      <div className="hero hero-simple">
        <div className="hero-copy">
          <span className="badge">AI 활동 적합도 분석</span>
          <h1>지금 보고있는 공고 지원하실건가요?</h1>
          <p>
            공고를 보고 고민만 하던 시간을 줄이고, 지금 지원해도 괜찮은지와
            무엇을 보완하면 좋을지 빠르게 확인하세요.
          </p>

          <div className="button-row">
            <button
              className="primary"
              onClick={() => setCurrentPage('profile')}
            >
              내 스펙 입력하기
            </button>
            <button
              className="secondary"
              onClick={() => setCurrentPage('posting')}
            >
              공고 분석 시작
            </button>
          </div>
        </div>
      </div>

      <div className="step-grid">
        {steps.map(([number, title, description]) => (
          <div className="step-card" key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuthPage({
  setCurrentPage,
  setAccessToken,
  setAuthUser,
  redirectPage = 'profile',
  clearLoginRequiredPage,
}) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm({
      ...form,
      [field]: value,
    });
  };

  const submitAuth = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      setNotice({
        type: 'error',
        message: '이메일과 비밀번호를 입력해주세요.',
      });
      return;
    }

    setIsLoading(true);
    setNotice(null);

    try {
      const endpoint =
        mode === 'login'
          ? `${API_BASE_URL}/auth/login`
          : `${API_BASE_URL}/auth/register`;

      const response = await axios.post(endpoint, {
        email: form.email,
        password: form.password,
      });

      const token = response.data.access_token;
      const user = {
        user_id: response.data.user_id,
        email: response.data.email,
      };

      localStorage.setItem('fitcheckToken', token);
      localStorage.setItem('fitcheckUser', JSON.stringify(user));

      setAccessToken(token);
      setAuthUser(user);

      if (clearLoginRequiredPage) {
        clearLoginRequiredPage();
      }

      setNotice({
        type: 'success',
        message:
          mode === 'login' ? '로그인되었습니다.' : '회원가입이 완료되었습니다.',
      });

      setCurrentPage(redirectPage);
    } catch (error) {
      console.error(error);
      setNotice({
        type: 'error',
        message:
          error.response?.data?.detail ||
          '로그인/회원가입 중 오류가 발생했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page compact-page">
      <PageTitle
        title={mode === 'login' ? '로그인' : '회원가입'}
        description="내 스펙과 분석 기록을 저장하려면 로그인이 필요합니다."
      />

      <div className="card narrow">
        <SectionHeader
          title={mode === 'login' ? '계정 로그인' : '새 계정 만들기'}
          eyebrow="Account"
          description="분석 기록과 내 스펙을 안전하게 저장합니다."
        />

        {notice && <Notice type={notice.type}>{notice.message}</Notice>}

        <Input
          label="이메일"
          placeholder="example@email.com"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
        />

        <Input
          label="비밀번호"
          placeholder="8자 이상 입력"
          value={form.password}
          onChange={(e) => handleChange('password', e.target.value)}
          type="password"
        />

        <div className="button-column">
          <button className="primary" onClick={submitAuth} disabled={isLoading}>
            {isLoading
              ? '처리 중...'
              : mode === 'login'
                ? '로그인하기'
                : '회원가입하기'}
          </button>

          <button
            className="secondary"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setNotice(null);
            }}
          >
            {mode === 'login'
              ? '계정이 없나요? 회원가입'
              : '이미 계정이 있나요? 로그인'}
          </button>
        </div>
      </div>
    </section>
  );
}

function ProfilePage({
  setCurrentPage,
  setSavedProfile,
  savedProfile,
  accessToken,
}) {
  const [profile, setProfile] = useState({
    status: '',
    major: '',
    experiences: '',
  });
  const [interestFields, setInterestFields] = useState([]);
  const [goalActivities, setGoalActivities] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [experienceTypes, setExperienceTypes] = useState([]);
  const [notice, setNotice] = useState(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const availableCapabilities = useMemo(() => {
    const merged = interestFields.flatMap(
      (field) => capabilityOptionsByField[field] || [],
    );

    return [...new Set(merged)];
  }, [interestFields]);

  const toggleItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter((value) => value !== item));
    } else {
      setList([...list, item]);
    }
  };

  useEffect(() => {
    if (interestFields.length === 0) {
      setCapabilities([]);
      return;
    }

    setCapabilities((prev) =>
      prev.filter((item) => availableCapabilities.includes(item)),
    );
  }, [interestFields, availableCapabilities]);

  useEffect(() => {
    if (!savedProfile) {
      return;
    }

    setProfile({
      status: savedProfile.status || '',
      major: savedProfile.major || '',
      experiences: savedProfile.experiences || '',
    });

    setInterestFields(savedProfile.interest_fields || []);
    setGoalActivities(savedProfile.goal_activities || []);
    setCapabilities(savedProfile.capabilities || []);
    setExperienceTypes(savedProfile.experience_types || []);
  }, [savedProfile]);

  const handleChange = (field, value) => {
    setProfile({
      ...profile,
      [field]: value,
    });
  };

  const saveProfile = async () => {
    const payload = {
      status: profile.status,
      major: profile.major,
      interest_fields: interestFields,
      goal_activities: goalActivities,
      capabilities: capabilities,
      experience_types: experienceTypes,
      experiences: profile.experiences,
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/profiles`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log('저장 응답:', response.data);
      setSavedProfile(response.data.profile);
      setNotice({
        type: 'success',
        message: '스펙 정보가 저장되었습니다.',
      });
      setIsSaveModalOpen(true);
    } catch (error) {
      console.error(error);
      setNotice({
        type: 'error',
        message: '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    }
  };

  return (
    <section className="page">
      <PageTitle
        title="스펙 입력"
        description="전공, 활동 경험, 보유 역량을 입력하면 공고 요구사항과 현재 준비도를 비교할 수 있습니다."
      />

      {notice && <Notice type={notice.type}>{notice.message}</Notice>}

      <div className="content-grid">
        <div>
          <section className="card">
            <SectionHeader title="기본 정보" eyebrow="Profile" />
            <div className="form-grid">
              <Input
                label="전공 / 계열"
                placeholder="예: 정보보호학과, 유아교육과"
                value={profile.major}
                onChange={(e) => handleChange('major', e.target.value)}
              />

              <Input
                label="현재 상태"
                placeholder="예: 3학년, 휴학, 취업준비중"
                value={profile.status}
                onChange={(e) => handleChange('status', e.target.value)}
              />
            </div>
          </section>

          <section className="card">
            <SectionHeader
              title="관심 분야와 목표 활동"
              eyebrow="Interest"
              description="관심 있는 분야와 이번에 도전하고 싶은 활동을 선택하세요."
            />
            <ChipGroup
              title="관심 분야"
              chips={[
                'IT/개발',
                '보안/네트워크',
                'AI/데이터',
                '디자인',
                '마케팅/콘텐츠',
                '교육/멘토링',
                '기획/창업',
                '봉사/사회문제',
              ]}
              selectedItems={interestFields}
              onToggle={(item) =>
                toggleItem(interestFields, setInterestFields, item)
              }
            />

            <ChipGroup
              title="목표 활동"
              chips={[
                '공모전 참여',
                '대외활동 합격',
                '학습 프로그램 참여',
                '부트캠프 참여',
                '포트폴리오 강화',
                '진로 탐색',
              ]}
              selectedItems={goalActivities}
              onToggle={(item) =>
                toggleItem(goalActivities, setGoalActivities, item)
              }
            />
          </section>

          <section className="card">
            <SectionHeader
              title="분야별 역량"
              eyebrow="Skills"
              description="공고 요구 조건과 비교할 수 있는 강점을 선택하세요."
            />
            {interestFields.length === 0 ? (
              <Notice type="info">
                관심 분야를 먼저 선택하면 관련 역량을 선택할 수 있습니다.
              </Notice>
            ) : (
              <ChipGroup
                title="역량 선택"
                chips={availableCapabilities}
                selectedItems={capabilities}
                onToggle={(item) =>
                  toggleItem(capabilities, setCapabilities, item)
                }
              />
            )}
          </section>

          <section className="card">
            <SectionHeader title="활동 경험" eyebrow="Experience" />
            <ChipGroup
              title="경험 유형"
              chips={[
                '개인 프로젝트',
                '팀 프로젝트',
                '동아리 활동',
                '공모전 참여',
                '대외활동',
                '서포터즈',
                '멘토링',
                '봉사활동',
                '스터디',
              ]}
              selectedItems={experienceTypes}
              onToggle={(item) =>
                toggleItem(experienceTypes, setExperienceTypes, item)
              }
            />

            <Textarea
              label="활동 상세 내용"
              placeholder="활동명, 역할, 주요 활동 내용, 결과물 등을 입력하세요."
              value={profile.experiences}
              onChange={(e) => handleChange('experiences', e.target.value)}
            />
          </section>
        </div>

        <aside className="summary-card">
          <SectionHeader title="입력 요약" eyebrow="Summary" />
          <SummaryRow label="관심 분야" values={interestFields} />
          <SummaryRow label="목표 활동" values={goalActivities} />
          <SummaryRow label="선택 역량" values={capabilities} />
          <SummaryRow label="경험 유형" values={experienceTypes} />
          <div className="summary-note">
            <span>활동 상세</span>
            <p>{profile.experiences || '아직 입력된 활동 상세가 없습니다.'}</p>
          </div>
        </aside>
      </div>

      <div className="page-actions">
        <button className="secondary" onClick={saveProfile}>
          내 스펙 저장
        </button>
        <button className="primary" onClick={() => setCurrentPage('posting')}>
          공고 분석으로 이동
        </button>
      </div>
      {isSaveModalOpen && (
        <ConfirmModal
          title="스펙 정보가 저장되었습니다"
          description="이제 입력한 스펙을 바탕으로 공고와의 지원 준비도를 분석할 수 있습니다."
          confirmText="공고 분석하기"
          cancelText="계속 수정하기"
          onConfirm={() => {
            setIsSaveModalOpen(false);
            setCurrentPage('posting');
          }}
          onCancel={() => {
            setIsSaveModalOpen(false);
          }}
        />
      )}
    </section>
  );
}

function PostingPage({
  setCurrentPage,
  setAnalysisResult,
  savedProfile,
  accessToken,
}) {
  const [url, setUrl] = useState('');
  const [postingMessage, setPostingMessage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalysisDone, setIsAnalysisDone] = useState(false);

  const submitPostingUrl = async () => {
    if (!url.trim()) {
      setPostingMessage({ type: 'error', text: '공고 URL을 입력해주세요.' });
      return;
    }

    if (!savedProfile) {
      setPostingMessage({
        type: 'error',
        text: '스펙을 먼저 저장해주세요. 사용자 정보가 있어야 정확한 분석이 가능합니다.',
      });
      return;
    }

    setIsAnalyzing(true);
    setPostingMessage(null);
    setIsAnalysisDone(false);

    try {
      const postingResponse = await axios.post(`${API_BASE_URL}/postings/url`, {
        user_id: 1,
        url: url,
      });

      console.log('공고 URL 응답:', postingResponse.data);

      if (!postingResponse.data.success) {
        setPostingMessage({
          type: 'error',
          text:
            postingResponse.data.message ||
            'URL에서 공고 내용을 가져오지 못했습니다. PDF/텍스트 입력으로 진행할 수 있습니다.',
        });
        return;
      }

      const posting = postingResponse.data.posting;

      const analysisResponse = await axios.post(
        `${API_BASE_URL}/analysis/gemini`,
        {
          user_profile: savedProfile,
          posting_title: posting.title,
          posting_type: posting.posting_type,
          posting_text: posting.raw_text,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      console.log('Gemini URL 분석 결과 응답:', analysisResponse.data);

      if (analysisResponse.data.success) {
        setAnalysisResult(analysisResponse.data.analysis);
        setIsAnalysisDone(true);
        setPostingMessage({
          type: 'success',
          text: '분석이 완료되었습니다. 결과 화면에서 자세한 리포트를 확인할 수 있습니다.',
        });
      } else {
        setPostingMessage({
          type: 'error',
          text: analysisResponse.data.message || 'Gemini 분석에 실패했습니다.',
        });
      }
    } catch (error) {
      console.error(error);
      setPostingMessage({
        type: 'error',
        text: 'URL에서 공고 내용을 가져오지 못했습니다. PDF/텍스트 입력으로 진행할 수 있습니다.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="page compact-page">
      <PageTitle
        title="공고 URL 분석"
        description="공모전, 대외활동, 학습 지원 프로그램 공고 링크를 입력하세요."
      />

      <div className="card narrow">
        <SectionHeader
          title="URL로 공고 가져오기"
          eyebrow="Posting"
          description="링크에서 공고 내용을 추출한 뒤 내 스펙과 바로 비교합니다."
        />

        <Input
          label="공고 URL"
          placeholder="https://example.com/posting"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <Notice type="info">
          URL 분석이 어려운 페이지라면 PDF 파일이나 공고 본문을 직접 입력할 수
          있습니다.
        </Notice>

        {postingMessage && (
          <Notice type={postingMessage.type}>
            {postingMessage.text}
            {postingMessage.type === 'error' && (
              <button
                className="notice-action"
                onClick={() => setCurrentPage('postingText')}
              >
                PDF/텍스트로 진행
              </button>
            )}
          </Notice>
        )}

        <div className="button-column">
          <button
            className="primary"
            onClick={submitPostingUrl}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'AI가 공고를 분석 중입니다...' : 'URL로 분석 시작'}
          </button>

          {isAnalysisDone && (
            <button
              className="primary"
              onClick={() => setCurrentPage('result')}
            >
              분석 결과 보기
            </button>
          )}

          <button
            className="secondary"
            onClick={() => setCurrentPage('postingText')}
          >
            PDF/텍스트로 입력하기
          </button>
        </div>
      </div>
    </section>
  );
}

function PostingTextPage({
  setCurrentPage,
  setAnalysisResult,
  savedProfile,
  accessToken,
}) {
  const [postingForm, setPostingForm] = useState({
    title: '',
    posting_type: '학습 지원 프로그램',
    content: '',
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalysisDone, setIsAnalysisDone] = useState(false);

  const handleChange = (field, value) => {
    setPostingForm({
      ...postingForm,
      [field]: value,
    });
  };

  const createGeminiAnalysis = async (posting, postingText) => {
    if (!savedProfile) {
      setMessage({
        type: 'error',
        text: '스펙을 먼저 저장해주세요. 사용자 정보가 있어야 정확한 분석이 가능합니다.',
      });
      return;
    }

    const analysisResponse = await axios.post(
      `${API_BASE_URL}/analysis/gemini`,
      {
        user_profile: savedProfile,
        posting_title: posting.title,
        posting_type: posting.posting_type,
        posting_text: postingText,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    console.log('Gemini 분석 결과 응답:', analysisResponse.data);

    if (analysisResponse.data.success) {
      setAnalysisResult(analysisResponse.data.analysis);
      setIsAnalysisDone(true);
      setMessage({
        type: 'success',
        text: '분석이 완료되었습니다. 결과 화면에서 자세한 리포트를 확인할 수 있습니다.',
      });
    } else {
      setMessage({
        type: 'error',
        text: analysisResponse.data.message || 'Gemini 분석에 실패했습니다.',
      });
    }
  };

  const submitPosting = async () => {
    if (!postingForm.title.trim()) {
      setMessage({ type: 'error', text: '공고 제목을 입력해주세요.' });
      return;
    }

    setIsAnalyzing(true);
    setMessage(null);
    setIsAnalysisDone(false);

    try {
      if (pdfFile) {
        const formData = new FormData();
        formData.append('user_id', 1);
        formData.append('title', postingForm.title);
        formData.append('posting_type', postingForm.posting_type);
        formData.append('file', pdfFile);

        const pdfResponse = await axios.post(
          `${API_BASE_URL}/postings/pdf`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );

        console.log('PDF 업로드 응답:', pdfResponse.data);

        if (!pdfResponse.data.success) {
          setMessage({ type: 'error', text: pdfResponse.data.message });
          return;
        }

        await createGeminiAnalysis(
          pdfResponse.data.posting,
          pdfResponse.data.posting.extracted_text,
        );

        return;
      }

      if (!postingForm.content.trim()) {
        setMessage({
          type: 'error',
          text: '공고 내용을 입력하거나 PDF 파일을 업로드해주세요.',
        });
        return;
      }

      const textResponse = await axios.post(`${API_BASE_URL}/postings/text`, {
        user_id: 1,
        title: postingForm.title,
        posting_type: postingForm.posting_type,
        content: postingForm.content,
      });

      console.log('공고 텍스트 응답:', textResponse.data);

      if (!textResponse.data.success) {
        setMessage({ type: 'error', text: textResponse.data.message });
        return;
      }

      await createGeminiAnalysis(
        textResponse.data.posting,
        postingForm.content,
      );
    } catch (error) {
      console.error(error);
      setMessage({
        type: 'error',
        text: '공고 전송 또는 분석 중 오류가 발생했습니다.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="page compact-page">
      <PageTitle
        title="PDF/텍스트 입력"
        description="PDF를 업로드하거나, 공고 내용을 직접 붙여넣으세요."
      />

      <div className="card narrow">
        <SectionHeader title="공고 기본 정보" eyebrow="Manual input" />

        <div className="form-grid">
          <Input
            label="공고 제목"
            placeholder="예: 화이트햇 스쿨 교육생 모집"
            value={postingForm.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />

          <label className="field">
            <span>공고 유형</span>
            <select
              value={postingForm.posting_type}
              onChange={(e) => handleChange('posting_type', e.target.value)}
            >
              <option>공모전</option>
              <option>대외활동</option>
              <option>학습 지원 프로그램</option>
              <option>부트캠프</option>
              <option>해커톤</option>
              <option>서포터즈</option>
              <option>멘토링</option>
              <option>기타</option>
            </select>
          </label>
        </div>

        <div className="input-split">
          <label className="upload-box">
            <span>PDF 업로드</span>
            <strong>공고 PDF 파일 선택</strong>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files[0];
                setPdfFile(file || null);
                if (file) {
                  setMessage({
                    type: 'info',
                    text: `${file.name} 파일이 선택되었습니다.`,
                  });
                }
              }}
            />
          </label>

          <div className="manual-input">
            <Textarea
              label="공고 내용 직접 입력"
              placeholder="모집 대상, 요구 역량, 제출 서류, 활동 기간, 마감일 등이 포함된 공고 내용을 붙여넣으세요."
              value={postingForm.content}
              onChange={(e) => handleChange('content', e.target.value)}
            />
          </div>
        </div>

        {pdfFile && (
          <div className="file-chip">
            <span>선택한 파일</span>
            <strong>{pdfFile.name}</strong>
          </div>
        )}

        <Notice type="info">
          PDF가 선택되어 있으면 PDF 내용을 우선 분석하고, PDF가 없으면 입력한
          텍스트를 기준으로 분석합니다.
        </Notice>

        {message && <Notice type={message.type}>{message.text}</Notice>}

        <div className="button-column">
          <button
            className="primary"
            onClick={submitPosting}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'AI가 공고를 분석 중입니다...' : '분석 시작하기'}
          </button>

          {isAnalysisDone && (
            <button
              className="primary"
              onClick={() => setCurrentPage('result')}
            >
              분석 결과 보기
            </button>
          )}

          <button
            className="secondary"
            onClick={() => setCurrentPage('posting')}
          >
            URL 입력으로 돌아가기
          </button>
        </div>
      </div>
    </section>
  );
}

function LoadingPage({ setCurrentPage }) {
  const steps = [
    '공고 내용 추출 중',
    '사용자 정보 비교 중',
    '항목별 적합도 계산 중',
    '준비 전략 생성 중',
  ];

  return (
    <section className="page center">
      <div className="card loading-card">
        <SectionHeader
          title="AI가 공고를 분석 중입니다"
          eyebrow="Analyzing"
          description="입력한 정보와 공고 요구사항을 비교해 결과 화면을 준비하고 있습니다."
        />
        <div className="progress">
          <div className="progress-bar" />
        </div>
        <div className="analysis-steps">
          {steps.map((step, index) => (
            <div className="analysis-step" key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
        <button className="primary" onClick={() => setCurrentPage('result')}>
          결과 확인하기
        </button>
      </div>
    </section>
  );
}

function ResultPage({ setCurrentPage, analysisResult }) {
  function getScoreStatus(score) {
    if (score >= 90) return '높은 적합도';
    if (score >= 75) return '지원 가능';
    if (score >= 60) return '지원 전 보완 권장';
    if (score >= 40) return '기초 보완 필요';
    return '준비 부족';
  }

  const scoreCards = useMemo(() => {
    if (!analysisResult?.scores) {
      return [];
    }

    return scoreWeights
      .map((item) => ({
        ...item,
        ...(analysisResult.scores[item.key] || {}),
      }))
      .filter((item) => item.title || item.score !== undefined);
  }, [analysisResult]);

  if (!analysisResult) {
    return (
      <section className="page">
        <PageTitle
          title="분석 결과 리포트"
          description="아직 생성된 분석 결과가 없습니다."
        />

        <div className="card">
          <Notice type="info">
            분석 결과가 없습니다. 공고 분석을 먼저 진행해주세요.
          </Notice>

          <div className="page-actions">
            <button
              className="primary"
              onClick={() => setCurrentPage('posting')}
            >
              공고 분석하러 가기
            </button>
          </div>
        </div>
      </section>
    );
  }

  const totalScore = analysisResult.total_score ?? 0;
  const totalScoreStatus = getScoreStatus(totalScore);
  const confidenceText =
    {
      높음: '정보 충분',
      보통: '일부 정보 기반',
      낮음: '추가 정보 필요',
    }[analysisResult.confidence] || '일부 정보 기반';
  const recommendationStatus =
    analysisResult.recommendation?.status || totalScoreStatus;

  return (
    <section className="page">
      <PageTitle
        title="분석 결과 리포트"
        description="입력된 정보와 공고 내용을 바탕으로 적합도와 준비 전략을 정리했습니다."
      />

      <div className="result-summary">
        <div className="result-main">
          <span className="badge">분석 완료</span>
          <h2>{recommendationStatus}</h2>
          <p>
            <strong>
              총합 준비도 {analysisResult.total_score ?? '-'}% ·{' '}
              {totalScoreStatus}
            </strong>
          </p>
          <p>{analysisResult.summary || '분석 요약이 제공되지 않았습니다.'}</p>
          <p className="helper">
            분석 공고: {analysisResult.posting_title || '공고명 미확인'}
          </p>
        </div>
        <div className="result-metrics">
          <Metric
            label="총합 준비도"
            value={`${analysisResult.total_score ?? '-'}%`}
          />
          <Metric label="입력 정보 충분도" value={confidenceText} />
          <Metric
            label="공고 난이도"
            value={
              analysisResult.difficulty_level
                ? `${analysisResult.difficulty_level} (${analysisResult.difficulty_score ?? '-'}점)`
                : '보통'
            }
          />
        </div>
      </div>

      <section className="card">
        <SectionHeader
          title="종합 적합도 산출 기준"
          eyebrow="Scoring"
          description="기초 역량, 활동 경험, 성장 방향, 준비 일정을 가중치로 반영합니다."
        />
        <div className="weight-grid">
          {scoreWeights.map((item) => (
            <div className="weight-card" key={item.key}>
              <div>
                <span>{item.label}</span>
                <strong>{item.weight}%</strong>
              </div>
              <div className="mini-bar">
                <div style={{ width: `${item.weight * 2}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="score-grid">
        {scoreCards.map((card) => (
          <ScoreCard
            key={card.key}
            card={card}
            scoreStatus={getScoreStatus(card.score ?? 0)}
          />
        ))}
      </div>

      <div className="grid-2">
        {scoreCards.map((card) => (
          <section className="card weak-card" key={`${card.key}-weak`}>
            <SectionHeader
              title={`${card.title || card.label} 보완 필요 요소`}
              eyebrow="Needs"
            />
            <ul className="clean-list">
              {(
                card.weak_factors || ['추가 보완 요소가 제공되지 않았습니다.']
              ).map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="card action-card">
        <SectionHeader
          title="최종 추천 액션"
          eyebrow="Next action"
          description={analysisResult.recommendation?.status}
        />
        <div className="checklist">
          {(
            analysisResult.recommendation?.priority_actions || [
              '공고 요구사항을 다시 확인하고 준비 일정을 세워보세요.',
            ]
          ).map((action) => (
            <label key={action}>
              <input type="checkbox" readOnly />
              <span>{action}</span>
            </label>
          ))}
        </div>
      </section>

      <Notice type="info">
        본 결과는 입력된 정보와 공고 내용을 바탕으로 한 참고용 분석입니다.
        가능성을 현실로 만드는 것은 사용자님의 준비와 노력입니다.
      </Notice>

      <div className="page-actions">
        <button className="secondary" onClick={() => setCurrentPage('posting')}>
          재분석하기
        </button>
        <button className="primary" onClick={() => setCurrentPage('mypage')}>
          마이페이지에서 보기
        </button>
      </div>
    </section>
  );
}

function HistoryPage({
  setCurrentPage,
  analysisResult,
  setAnalysisResult,
  accessToken,
}) {
  const [records, setRecords] = useState([]);
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [fieldFilter, setFieldFilter] = useState('전체');

  useEffect(() => {
    if (!accessToken) {
      setNotice({
        type: 'error',
        text: '분석 기록을 보려면 로그인이 필요합니다.',
      });
      return;
    }

    setIsLoading(true);
    setNotice(null);

    axios
      .get(`${API_BASE_URL}/analysis-records`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      .then((response) => {
        if (response.data.success) {
          setRecords(response.data.records || []);
        }
      })
      .catch((error) => {
        console.error('분석 기록 불러오기 실패:', error);
        setNotice({
          type: 'error',
          text: '분석 기록을 불러오지 못했습니다.',
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [accessToken]);

  const parseDeadline = (deadline) => {
    if (!deadline) {
      return null;
    }

    const text = String(deadline);
    const dateParts = text.match(/\d+/g);

    if (dateParts?.length >= 3) {
      const [year, month, day] = dateParts.map(Number);
      const parsedDate = new Date(year, month - 1, day);

      if (
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month - 1 &&
        parsedDate.getDate() === day
      ) {
        return parsedDate;
      }
    }

    const fallbackDate = new Date(text);
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  };

  const getRecordStatus = (record) => {
    const deadlineDate = parseDeadline(record.result_json?.deadline);

    if (!deadlineDate) {
      return '상태 미확인';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);

    return deadlineDate >= today ? '진행중' : '진행완';
  };

  const getStatusClass = (status) => {
    if (status === '진행중') return 'active';
    if (status === '진행완') return 'done';
    return 'unknown';
  };

  const typeOptions = useMemo(
    () => [
      '전체',
      ...new Set(records.map((record) => record.posting_type).filter(Boolean)),
    ],
    [records],
  );
  const fieldOptions = useMemo(
    () => [
      '전체',
      ...new Set(
        records
          .map((record) => record.result_json?.field)
          .filter(Boolean),
      ),
    ],
    [records],
  );
  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const recordStatus = getRecordStatus(record);
        const statusMatched =
          statusFilter === '전체' || recordStatus === statusFilter;
        const typeMatched =
          typeFilter === '전체' || record.posting_type === typeFilter;
        const fieldMatched =
          fieldFilter === '전체' || record.result_json?.field === fieldFilter;

        return statusMatched && typeMatched && fieldMatched;
      }),
    [records, statusFilter, typeFilter, fieldFilter],
  );

  const openRecord = async (recordId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/analysis-records/${recordId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.data.success) {
        setAnalysisResult(response.data.record.result_json);
        setCurrentPage('result');
      }
    } catch (error) {
      console.error('분석 기록 상세 조회 실패:', error);
      setNotice({
        type: 'error',
        text: '분석 기록 상세 내용을 불러오지 못했습니다.',
      });
    }
  };

  return (
    <section className="page">
      <PageTitle
        title="분석 기록"
        description="저장된 공고 분석 결과를 다시 확인할 수 있습니다."
      />

      {notice && <Notice type={notice.type}>{notice.text}</Notice>}

      {records.length > 0 && (
        <section className="card history-filter-card">
          <div className="filter-row">
            <label>
              <span>진행 상태</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>전체</option>
                <option>진행중</option>
                <option>진행완</option>
                <option>상태 미확인</option>
              </select>
            </label>

            <label>
              <span>공고 유형</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                {typeOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              <span>분야</span>
              <select
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
              >
                {fieldOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="card">
          <p>분석 기록을 불러오는 중입니다...</p>
        </div>
      ) : records.length > 0 && filteredRecords.length > 0 ? (
        <div className="history-list">
          {filteredRecords.map((record) => {
            const recordStatus = getRecordStatus(record);
            const recordField = record.result_json?.field;

            return (
              <div className="history-card" key={record.id}>
                <div>
                  <div className="history-badges">
                    <span className="badge subtle">
                      {record.posting_type || '분석 결과'}
                    </span>
                    <span
                      className={`status-badge ${getStatusClass(recordStatus)}`}
                    >
                      {recordStatus}
                    </span>
                  </div>
                <h3>{record.posting_title || '공고명 미확인'}</h3>
                <p>
                  종합 준비도 {record.total_score ?? '-'}%
                  {recordField ? ` · 분야 ${recordField}` : ''} · 분석일{' '}
                  {record.created_at
                    ? new Date(record.created_at).toLocaleDateString()
                    : '미확인'}
                </p>
              </div>

              <button
                className="secondary"
                onClick={() => openRecord(record.id)}
              >
                다시 보기
              </button>
              {/* TODO: 백엔드 삭제 API 추가 후 삭제 버튼 구현 */}
            </div>
            );
          })}
        </div>
      ) : records.length > 0 ? (
        <EmptyState
          title="조건에 맞는 분석 기록이 없습니다."
          description="필터를 변경하거나 전체 기록을 확인해보세요."
        />
      ) : analysisResult ? (
        <div className="history-card">
          <div>
            <span className="badge subtle">
              {analysisResult.posting_type || '분석 결과'}
            </span>
            <h3>{analysisResult.posting_title || '공고명 미확인'}</h3>
            <p>
              종합 적합도 {analysisResult.total_score ?? '-'}% · 이번 세션 분석
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => setCurrentPage('result')}
          >
            다시 보기
          </button>
        </div>
      ) : (
        <EmptyState
          title="아직 분석 기록이 없습니다."
          description="공고를 분석하면 이곳에 기록됩니다."
          actionLabel="공고 분석하기"
          onAction={() => setCurrentPage('posting')}
        />
      )}
    </section>
  );
}

function MyPage({ setCurrentPage, savedProfile, analysisResult }) {
  const tagSections = [
    ['관심 분야', savedProfile?.interest_fields],
    ['목표 활동', savedProfile?.goal_activities],
    ['역량', savedProfile?.capabilities],
    ['경험 유형', savedProfile?.experience_types],
  ];
  const confidenceText =
    {
      높음: '정보 충분',
      보통: '일부 정보 기반',
      낮음: '추가 정보 필요',
    }[analysisResult?.confidence] || '일부 정보 기반';
  const weakItems = Object.values(analysisResult?.scores || {}).flatMap(
    (score) => score.weak_factors || [],
  );
  const uniqueWeakItems = [...new Set(weakItems)];

  return (
    <section className="page">
      <PageTitle
        title="마이페이지"
        description="저장된 내 스펙과 준비 방향을 한눈에 확인합니다."
      />

      <div className="grid-2">
        <section className="card">
          <SectionHeader title="스펙 요약" eyebrow="My profile" />

          {savedProfile ? (
            <>
              <div className="profile-meta">
                <div>
                  <span>현재 상태</span>
                  <strong>{savedProfile.status || '미입력'}</strong>
                </div>
                <div>
                  <span>전공</span>
                  <strong>{savedProfile.major || '미입력'}</strong>
                </div>
              </div>

              {tagSections.map(([label, values]) => (
                <SummaryRow key={label} label={label} values={values || []} />
              ))}

              <div className="summary-note">
                <span>활동 경험</span>
                <p>
                  {savedProfile.experiences ||
                    '아직 입력된 활동 경험이 없습니다.'}
                </p>
              </div>
            </>
          ) : (
            <EmptyState
              title="저장된 스펙이 없습니다."
              description="스펙을 입력하면 공고 분석 정확도가 올라갑니다."
              actionLabel="스펙 입력"
              onAction={() => setCurrentPage('profile')}
            />
          )}

          {savedProfile && (
            <div className="page-actions">
              <button
                className="secondary"
                onClick={() => setCurrentPage('profile')}
              >
                스펙 수정하기
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <SectionHeader title="최근 분석 결과" eyebrow="Recent result" />
          {analysisResult ? (
            <>
              <div className="result-metrics">
                <Metric
                  label="최근 분석 공고명"
                  value={analysisResult.posting_title || '공고명 미확인'}
                />
                <Metric
                  label="총합 준비도"
                  value={`${analysisResult.total_score ?? '-'}%`}
                />
                <Metric
                  label="추천 상태"
                  value={analysisResult.recommendation?.status || '-'}
                />
                <Metric
                  label="공고 난이도"
                  value={analysisResult.difficulty_level || '-'}
                />
                <Metric label="입력 정보 충분도" value={confidenceText} />
              </div>
            </>
          ) : (
            <EmptyState
              title="최근 분석 결과가 없습니다."
              description="공고를 분석하면 최근 결과와 보완할 항목이 이곳에 표시됩니다."
              actionLabel="공고 분석하기"
              onAction={() => setCurrentPage('posting')}
            />
          )}
        </section>
      </div>

      {analysisResult && (
        <section className="card weak-card">
          <SectionHeader title="지원 전 보완할 항목" eyebrow="Needs" />
          {uniqueWeakItems.length > 0 ? (
            <ul className="clean-list">
              {uniqueWeakItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="helper">
              현재 분석 결과에서 뚜렷한 보완 항목이 확인되지 않았습니다.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <div className="calendar-head">
          <SectionHeader title="준비 캘린더" eyebrow="Calendar" />
          <div className="legend">
            <span>
              <i className="legend-blue" />
              추천 준비 기간
            </span>
            <span>
              <i className="legend-red" />
              공고 마감일
            </span>
          </div>
        </div>
        {analysisResult ? (
          <div className="summary-note">
            <span>최근 분석 공고 기준 준비 일정</span>
            <p>마감일: {analysisResult.deadline || '마감일 정보 없음'}</p>
            <p>
              추천 준비 기간:{' '}
              {analysisResult.estimated_preparation_days
                ? `${analysisResult.estimated_preparation_days}일`
                : '정보 없음'}
            </p>
            <p>파란색은 추천 준비 기간, 빨간색은 공고 마감일입니다.</p>
          </div>
        ) : (
          <p className="helper">
            공고를 분석하면 추천 준비 기간과 마감일을 기준으로 캘린더를 확인할
            수 있습니다.
          </p>
        )}
        <div className="calendar">
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              className={
                i >= 9 && i <= 22
                  ? 'day prepare'
                  : i === 23
                    ? 'day deadline'
                    : 'day'
              }
            >
              {i + 1}
            </div>
          ))}
        </div>
      </section>

      <div className="page-actions">
        <button className="secondary" onClick={() => setCurrentPage('profile')}>
          스펙 수정하기
        </button>
        <button className="primary" onClick={() => setCurrentPage('posting')}>
          공고 분석하기
        </button>
        <button className="secondary" onClick={() => setCurrentPage('history')}>
          분석 기록 보기
        </button>
      </div>
    </section>
  );
}

function PageTitle({ title, description }) {
  return (
    <div className="page-title">
      <span>FitCheck</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function SectionHeader({ title, eyebrow, description }) {
  return (
    <div className="section-header">
      {eyebrow && <span>{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function Input({ label, placeholder, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
      />
    </label>
  );
}

function Textarea({ label, placeholder, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
      />
    </label>
  );
}

function ChipGroup({ title, chips, selectedItems = [], onToggle }) {
  return (
    <div className="chip-group">
      <h3>{title}</h3>
      <div className="chips">
        {chips.map((chip) => {
          const isSelected = selectedItems.includes(chip);

          return (
            <button
              key={chip}
              type="button"
              className={isSelected ? 'chip selected' : 'chip'}
              onClick={() => {
                if (onToggle) {
                  onToggle(chip);
                }
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoreCard({ card, scoreStatus }) {
  const score = Number(card.score ?? 0);

  return (
    <section className="card score-card">
      <div className="score-card-head">
        <div>
          <span>{card.label}</span>
          <h2>{card.title || card.label}</h2>
        </div>
        <div>
          <strong>{card.score ?? '-'}%</strong>
          <span className="badge subtle">{scoreStatus}</span>
        </div>
      </div>
      <div className="mini-bar">
        <div style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <div className="score-detail-grid">
        <ScoreDetail label="공고 요구 수준" value={card.required_score} />
        <ScoreDetail label="사용자 준비도" value={card.user_score} />
      </div>
      <div className="factor-block">
        <span>긍정 요소</span>
        <ul>
          {(card.positive_factors || ['긍정 요소가 제공되지 않았습니다.']).map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
      </div>
      {card.reason && (
        <div className="reason-box">
          <span>판단 근거</span>
          <p>{card.reason}</p>
        </div>
      )}
    </section>
  );
}

function ScoreDetail({ label, value }) {
  return (
    <div className="score-detail">
      <span>{label}</span>
      <strong>
        {value !== undefined && value !== null ? `${value}%` : '-'}
      </strong>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Notice({ type = 'info', children }) {
  return <div className={`notice ${type}`}>{children}</div>;
}

function SummaryRow({ label, values }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <div className="tag-list">
        {values?.length > 0 ? (
          values.map((value) => <em key={value}>{value}</em>)
        ) : (
          <p>선택 없음</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && (
        <button className="primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-backdrop">
      <div className="confirm-modal">
        <h2>{title}</h2>
        <p>{description}</p>

        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="primary" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
