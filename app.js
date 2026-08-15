let appState = {
    role: 'STUDENT',
    testsIndex: [],
    currentTest: null,
    currentQuestions: [],
    userAnswers: {},
    currentQIndex: 0,
    timerInterval: null,
    timeRemaining: 0,
    timeSpent: 0
};

document.addEventListener('DOMContentLoaded', () => {
    loadTestIndex();
});

async function loadTestIndex() {
    try {
        const response = await fetch('tests/index.json');
        if (response.ok) {
            appState.testsIndex = await response.json();
        } else {
            appState.testsIndex = getFallbackTestIndex();
        }
    } catch (err) {
        appState.testsIndex = getFallbackTestIndex();
    }
    renderStudentTests('ALL');
    renderAdminTestTable();
}

function getFallbackTestIndex() {
    return [
        {
            "id": "tgt-gs-001",
            "name": "TGT GS Isolated Practice Test 1",
            "exam": "TGT",
            "category": "GS",
            "subject": "General Studies (TGT Specific)",
            "file": "tests/tgt-gs-001.txt",
            "questions": 5,
            "timePerQuestion": 45,
            "marks": 1,
            "negativeMarking": 0,
            "published": true
        }
    ];
}

function toggleAuthRole() {
    if (appState.role === 'STUDENT') {
        appState.role = 'ADMIN';
        document.getElementById('studentInterface').classList.remove('active');
        document.getElementById('adminInterface').classList.add('active');
        document.getElementById('userRoleBadge').textContent = 'Admin Mode';
        document.getElementById('toggleAuthBtn').innerHTML = '<i class="fa-solid fa-graduation-cap"></i> Student View';
    } else {
        appState.role = 'STUDENT';
        document.getElementById('adminInterface').classList.remove('active');
        document.getElementById('studentInterface').classList.add('active');
        document.getElementById('userRoleBadge').textContent = 'Student';
        document.getElementById('toggleAuthBtn').innerHTML = '<i class="fa-solid fa-user-gear"></i> Admin Login';
    }
}

function switchStudentTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.getElementById('activeTestEngine').classList.add('hidden');
    document.getElementById('testResultView').classList.add('hidden');

    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) targetContent.classList.add('active');

    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
    if (btn) btn.classList.add('active');
}

function filterTests(category) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    renderStudentTests(category);
}

function renderStudentTests(category) {
    const container = document.getElementById('testCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    const filtered = category === 'ALL' 
        ? appState.testsIndex 
        : appState.testsIndex.filter(t => t.exam === category || t.category === category);

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-muted">इस श्रेणी में कोई टेस्ट उपलब्ध नहीं है।</p>`;
        return;
    }

    filtered.forEach(test => {
        if (!test.published && appState.role !== 'ADMIN') return;
        
        const card = document.createElement('div');
        card.className = 'test-card';
        card.innerHTML = `
            <div>
                <div class="test-card-header">
                    <span class="badge">${test.exam}</span>
                    <small class="text-muted">${test.subject}</small>
                </div>
                <h4>${test.name}</h4>
                <p style="font-size: 0.85rem; color: #4a5568; margin: 8px 0;">
                    प्रश्न: ${test.questions} | समय: ${Math.round(test.questions * test.timePerQuestion / 60)} मिनट
                </p>
            </div>
            <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" onclick="startTest('${test.id}')">
                <i class="fa-solid fa-play"></i> Start Test
            </button>
        `;
        container.appendChild(card);
    });
}

async function startTest(testId) {
    const testMeta = appState.testsIndex.find(t => t.id === testId);
    if (!testMeta) return alert('Test Metadata Not Found!');

    appState.currentTest = testMeta;
    appState.userAnswers = {};
    appState.currentQIndex = 0;

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('activeTestEngine').classList.remove('hidden');

    document.getElementById('currentTestTitle').textContent = testMeta.name;
    document.getElementById('currentTestMeta').textContent = `${testMeta.exam} | ${testMeta.subject}`;

    try {
        const res = await fetch(testMeta.file);
        const rawText = res.ok ? await res.text() : getFallbackTxtQuestions();
        appState.currentQuestions = parseTxtQuestions(rawText);
    } catch (e) {
        appState.currentQuestions = parseTxtQuestions(getFallbackTxtQuestions());
    }

    appState.timeRemaining = appState.currentQuestions.length * (testMeta.timePerQuestion || 45);
    appState.timeSpent = 0;
    startTimer();

    renderQuestion(0);
    renderPalette();
}

function parseTxtQuestions(rawTxt) {
    const questions = [];
    const blocks = rawTxt.replace(/\r/g, '').split(/\n\s*\n/);

    blocks.forEach(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 4) return;

        let qText = '';
        let options = [];
        let correctAns = '';
        let explanation = 'व्याख्या उपलब्ध नहीं है।';

        lines.forEach(line => {
            if (/^(\*\*\d+\.\*\*|\d+\.)/.test(line)) {
                qText = line.replace(/^(\*\*\d+\.\*\*|\d+\.)/, '').trim();
            } else if (/^\([A-D]\)/.test(line)) {
                options.push(line);
            } else if (/^(उत्तर|Answer):/i.test(line) || /^\*\*उत्तर:.*?\*\*/.test(line)) {
                const match = line.match(/\([A-D]\)|[A-D]/i);
                if (match) correctAns = match[0].replace(/[\(\)]/g, '').toUpperCase();
            } else if (/^(व्याख्या|Explanation):/i.test(line)) {
                explanation = line.replace(/^(व्याख्या|Explanation):/i, '').trim();
            }
        });

        if (qText && options.length >= 2) {
            questions.push({
                question: qText,
                options: options,
                answer: correctAns || 'A',
                explanation: explanation
            });
        }
    });

    return questions.length > 0 ? questions : getMockParsedQuestions();
}

function renderQuestion(index) {
    appState.currentQIndex = index;
    const q = appState.currentQuestions[index];
    
    document.getElementById('qCurrentIndex').textContent = index + 1;
    document.getElementById('qTotalCount').textContent = appState.currentQuestions.length;
    document.getElementById('qTextDisplay').textContent = `${index + 1}. ${q.question}`;

    const optsContainer = document.getElementById('optionsContainer');
    optsContainer.innerHTML = '';

    q.options.forEach((optText, optIdx) => {
        const optLetter = String.fromCharCode(65 + optIdx);
        const isChecked = appState.userAnswers[index] === optLetter;

        const optDiv = document.createElement('label');
        optDiv.className = 'option-item';
        optDiv.innerHTML = `
            <input type="radio" name="mcqOption" value="${optLetter}" ${isChecked ? 'checked' : ''} onchange="selectOption('${optLetter}')">
            <span>${optText}</span>
        `;
        optsContainer.appendChild(optDiv);
    });

    updatePaletteHighlight();
}

function selectOption(letter) {
    appState.userAnswers[appState.currentQIndex] = letter;
    updatePaletteHighlight();
}

function clearCurrentAnswer() {
    delete appState.userAnswers[appState.currentQIndex];
    renderQuestion(appState.currentQIndex);
}

function navigateQuestion(direction) {
    const nextIdx = appState.currentQIndex + direction;
    if (nextIdx >= 0 && nextIdx < appState.currentQuestions.length) {
        renderQuestion(nextIdx);
    }
}

function renderPalette() {
    const grid = document.getElementById('paletteGrid');
    grid.innerHTML = '';

    appState.currentQuestions.forEach((_, idx) => {
        const numBtn = document.createElement('div');
        numBtn.className = 'p-num';
        numBtn.id = `palette-btn-${idx}`;
        numBtn.textContent = idx + 1;
        numBtn.onclick = () => renderQuestion(idx);
        grid.appendChild(numBtn);
    });
    updatePaletteHighlight();
}

function updatePaletteHighlight() {
    appState.currentQuestions.forEach((_, idx) => {
        const btn = document.getElementById(`palette-btn-${idx}`);
        if (!btn) return;

        btn.className = 'p-num';
        if (idx === appState.currentQIndex) {
            btn.classList.add('current');
        } else if (appState.userAnswers[idx]) {
            btn.classList.add('answered');
        } else {
            btn.classList.add('unanswered');
        }
    });
}

function startTimer() {
    clearInterval(appState.timerInterval);
    appState.timerInterval = setInterval(() => {
        appState.timeRemaining--;
        appState.timeSpent++;

        const hrs = Math.floor(appState.timeRemaining / 3600);
        const mins = Math.floor((appState.timeRemaining % 3600) / 60);
        const secs = appState.timeRemaining % 60;

        document.getElementById('timerDisplay').textContent = 
            `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

        if (appState.timeRemaining <= 0) {
            clearInterval(appState.timerInterval);
            alert('समय समाप्त हो गया है! टेस्ट ऑटो-सबमिट किया जा रहा है।');
            calculateAndShowResult();
        }
    }, 1000);
}

function confirmSubmitTest() {
    if (confirm('क्या आप सुनिश्चित हैं कि आप टेस्ट जमा (Submit) करना चाहते हैं?')) {
        clearInterval(appState.timerInterval);
        calculateAndShowResult();
    }
}

function calculateAndShowResult() {
    document.getElementById('activeTestEngine').classList.add('hidden');
    document.getElementById('testResultView').classList.remove('hidden');

    let correct = 0;
    let wrong = 0;
    let attempted = 0;

    appState.currentQuestions.forEach((q, idx) => {
        const userAns = appState.userAnswers[idx];
        if (userAns) {
            attempted++;
            if (userAns === q.answer) correct++;
            else wrong++;
        }
    });

    const marksPerQ = appState.currentTest.marks || 1;
    const negMarking = appState.currentTest.negativeMarking || 0;
    const totalScore = (correct * marksPerQ) - (wrong * negMarking);
    const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : 0;

    document.getElementById('resTestName').textContent = appState.currentTest.name;
    document.getElementById('resScore').textContent = totalScore.toFixed(2);
    document.getElementById('resAccuracy').textContent = `${accuracy}%`;
    document.getElementById('resAttempted').textContent = attempted;
    document.getElementById('resCorrect').textContent = correct;
    document.getElementById('resWrong').textContent = wrong;
    
    const minsSpent = Math.floor(appState.timeSpent / 60);
    const secsSpent = appState.timeSpent % 60;
    document.getElementById('resTimeTaken').textContent = `${minsSpent}m ${secsSpent}s`;

    renderExplanations();
}

function renderExplanations() {
    const container = document.getElementById('explanationsContainer');
    container.innerHTML = '';

    appState.currentQuestions.forEach((q, idx) => {
        const userAns = appState.userAnswers[idx] || 'Not Attempted';
        const isCorrect = userAns === q.answer;

        const expBox = document.createElement('div');
        expBox.style.cssText = 'padding: 15px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; background: #fafafa;';
        expBox.innerHTML = `
            <p><strong>Q${idx + 1}: ${q.question}</strong></p>
            <p style="margin: 5px 0;">आपका उत्तर: <span class="${isCorrect ? 'text-success' : 'text-danger'}">${userAns}</span> | सही उत्तर: <strong class="text-success">${q.answer}</strong></p>
            <p style="font-size: 0.9rem; color: #4a5568;">💡 <strong>व्याख्या:</strong> ${q.explanation}</p>
        `;
        container.appendChild(expBox);
    });
}

function toggleDetailedExplanations() {
    document.getElementById('explanationsSection').classList.toggle('hidden');
}

function switchAdminTab(adminTabId) {
    document.querySelectorAll('.admin-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

    document.getElementById(`admin-tab-${adminTabId}`).classList.add('active');
    event.target.classList.add('active');
}

function renderAdminTestTable() {
    const tbody = document.getElementById('adminTestTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    appState.testsIndex.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.id}</td>
            <td>${t.name}</td>
            <td>${t.exam}</td>
            <td>${t.subject}</td>
            <td><span class="badge">${t.published ? 'Published' : 'Draft'}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('adminTotalTestsCount').textContent = appState.testsIndex.length;
    document.getElementById('adminPublishedCount').textContent = appState.testsIndex.filter(t => t.published).length;
}

function handleCreateTest(e) {
    e.preventDefault();
    const newTest = {
        id: document.getElementById('adminTestId').value,
        name: document.getElementById('adminTestName').value,
        exam: document.getElementById('adminExamCat').value,
        category: "GS",
        subject: document.getElementById('adminSubject').value,
        file: document.getElementById('adminFilePath').value,
        questions: 10,
        timePerQuestion: parseInt(document.getElementById('adminTimePerQ').value),
        marks: parseFloat(document.getElementById('adminMarks').value),
        negativeMarking: 0,
        published: true
    };

    appState.testsIndex.push(newTest);
    renderAdminTestTable();
    renderStudentTests('ALL');
    alert('नया टेस्ट सफलतापूर्वक जोड़ दिया गया है!');
    switchAdminTab('manage-tests');
}

function saveBrandingSettings() {
    const newTitle = document.getElementById('brandTitleInput').value;
    const primaryCol = document.getElementById('primaryColorInput').value;
    const accentCol = document.getElementById('accentColorInput').value;

    document.getElementById('brandTitleText').textContent = newTitle;
    document.documentElement.style.setProperty('--primary-color', primaryCol);
    document.documentElement.style.setProperty('--accent-color', accentCol);

    alert('ब्रांडिंग थीम को सफलतापूर्वक अपडेट कर दिया गया है!');
}

function getFallbackTxtQuestions() {
    return `
1. भारतीय संविधान का कौन सा अनुच्छेद संघ की कार्यपालिका शक्ति से संबंधित है?
(A) अनुच्छेद 52
(B) अनुच्छेद 53
(C) अनुच्छेद 54
(D) अनुच्छेद 55
उत्तर: (B)
व्याख्या: भारतीय संविधान का अनुच्छेद 53 यह प्रावधान करता है कि संघ की कार्यपालिका शक्ति राष्ट्रपति में निहित होगी।
    `;
}

function getMockParsedQuestions() {
    return [
        {
            question: "भारतीय संविधान का कौन सा अनुच्छेद संघ की कार्यपालिका शक्ति से संबंधित है?",
            options: ["(A) अनुच्छेद 52", "(B) अनुच्छेद 53", "(C) अनुच्छेद 54", "(D) अनुच्छेद 55"],
            answer: "B",
            explanation: "भारतीय संविधान का अनुच्छेद 53 यह प्रावधान करता है कि संघ की कार्यपालिका शक्ति राष्ट्रपति में निहित होगी।"
        }
    ];
}
