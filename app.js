let appState = {
    role: 'STUDENT',
    testsIndex: [],
    customTestsData: {},
    customPdfsData: [],
    registeredStudents: [],
    currentTest: null,
    currentQuestions: [],
    userAnswers: {},
    currentQIndex: 0,
    timerInterval: null,
    timeRemaining: 0,
    timeSpent: 0
};

document.addEventListener('DOMContentLoaded', () => {
    checkStudentRegistration();
    loadLocalCustomTests();
    loadLocalCustomPdfs();
    loadRegisteredStudents();
    loadTestIndex();
    renderStudentPdfs();
});

/* STUDENT REGISTRATION & LOGIN CHECK */
function checkStudentRegistration() {
    const studentInfo = localStorage.getItem('gs_junction_student_user');
    if (!studentInfo) {
        document.getElementById('studentLoginModal').classList.remove('hidden');
    } else {
        try {
            const student = JSON.parse(studentInfo);
            displayStudentProfile(student);
        } catch(e) {}
    }
}

function handleStudentLogin(e) {
    e.preventDefault();
    const name = document.getElementById('regStudentName').value.trim();
    const mobile = document.getElementById('regStudentMobile').value.trim();
    const city = document.getElementById('regStudentCity').value.trim();
    const dateTime = new Date().toLocaleDateString('hi-IN') + ' ' + new Date().toLocaleTimeString('hi-IN');

    const studentObj = { name, mobile, city, dateTime };

    // Save current student
    localStorage.setItem('gs_junction_student_user', JSON.stringify(studentObj));

    // Push to global student list for Admin
    let allStudents = [];
    try {
        const savedList = localStorage.getItem('gs_junction_all_students');
        if (savedList) allStudents = JSON.parse(savedList);
    } catch(err) { allStudents = []; }

    // Check if mobile already exists, update or add new
    const existingIndex = allStudents.findIndex(s => s.mobile === mobile);
    if (existingIndex >= 0) {
        allStudents[existingIndex] = studentObj;
    } else {
        allStudents.unshift(studentObj);
    }

    localStorage.setItem('gs_junction_all_students', JSON.stringify(allStudents));

    document.getElementById('studentLoginModal').classList.add('hidden');
    displayStudentProfile(studentObj);
    renderAdminStudentsTable();
    alert(`🎉 स्वागत है ${name} जी! आपकी जानकारी दर्ज कर ली गई है।`);
}

function displayStudentProfile(student) {
    const pName = document.getElementById('profileDisplayName');
    const pMob = document.getElementById('profileDisplayMobile');
    const pCity = document.getElementById('profileDisplayCity');
    if (pName) pName.textContent = student.name;
    if (pMob) pMob.textContent = student.mobile;
    if (pCity) pCity.textContent = student.city;
}

function loadRegisteredStudents() {
    try {
        const saved = localStorage.getItem('gs_junction_all_students');
        if (saved) appState.registeredStudents = JSON.parse(saved);
    } catch(e) { appState.registeredStudents = []; }
    renderAdminStudentsTable();
}

function renderAdminStudentsTable() {
    const tbody = document.getElementById('adminStudentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (appState.registeredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #666;">अभी तक कोई छात्र रजिस्टर नहीं हुआ है।</td></tr>`;
        document.getElementById('adminTotalStudentsCount').textContent = 0;
        return;
    }

    appState.registeredStudents.forEach((st, idx) => {
        tbody.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${st.name}</strong></td>
                <td>${st.mobile}</td>
                <td>${st.city}</td>
                <td><small style="color: #666;">${st.dateTime || 'नया'}</small></td>
            </tr>
        `;
    });

    document.getElementById('adminTotalStudentsCount').textContent = appState.registeredStudents.length;
}

function loadLocalCustomTests() {
    const saved = localStorage.getItem('gs_junction_custom_tests');
    if (saved) {
        try { appState.customTestsData = JSON.parse(saved); } catch(e) { appState.customTestsData = {}; }
    }
}

function loadLocalCustomPdfs() {
    const saved = localStorage.getItem('gs_junction_custom_pdfs');
    if (saved) {
        try { appState.customPdfsData = JSON.parse(saved); } catch(e) { appState.customPdfsData = []; }
    }
}

async function loadTestIndex() {
    try {
        const response = await fetch('tests/index.json');
        if (response.ok) { appState.testsIndex = await response.json(); }
        else { appState.testsIndex = getFallbackTestIndex(); }
    } catch (err) {
        appState.testsIndex = getFallbackTestIndex();
    }

    Object.keys(appState.customTestsData).forEach(testId => {
        const customItem = appState.customTestsData[testId];
        if (!appState.testsIndex.some(t => t.id === testId)) {
            appState.testsIndex.unshift(customItem.meta);
        }
    });

    renderStudentTests('ALL');
    renderAdminTestTable();
}

function getFallbackTestIndex() {
    return [{
        "id": "tgt-gs-001",
        "name": "TGT GS Isolated Practice Test 1",
        "exam": "TGT",
        "category": "GS",
        "subject": "General Studies",
        "file": "tests/tgt-gs-001.txt",
        "questions": 2,
        "timePerQuestion": 45,
        "marks": 1,
        "negativeMarking": 0,
        "published": true
    }];
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
    
    document.getElementById('activeTestEngine')?.classList.add('hidden');
    document.getElementById('testResultView')?.classList.add('hidden');

    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) targetContent.classList.add('active');

    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
    if (btn) btn.classList.add('active');
}

function filterTests(category) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
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
                <div class="test-card-header"><span class="badge">${test.exam}</span><small class="text-muted">${test.subject}</small></div>
                <h4>${test.name}</h4>
                <p style="font-size: 0.85rem; color: #4a5568; margin: 8px 0;">प्रश्न: ${test.questions || 'विस्तृत'}</p>
            </div>
            <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" onclick="startTest('${test.id}')"><i class="fa-solid fa-play"></i> Start Test</button>
        `;
        container.appendChild(card);
    });
}

function parseTxtQuestions(rawTxt) {
    const questions = [];
    const rawBlocks = rawTxt.split(/(?=(?:प्रश्न\s*\d+\.?|\b\d+\.\s))/i);

    rawBlocks.forEach(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 3) return;

        let qText = '';
        let options = [];
        let correctAns = 'A';
        let explanation = 'व्याख्या उपलब्ध नहीं है।';

        lines.forEach(line => {
            if (/^(प्रश्न\s*\d+\.?|\d+\.)/i.test(line)) {
                qText = line.replace(/^(प्रश्न\s*\d+\.?|\d+\.)/i, '').trim();
            } else if (/^\([A-D]\)/i.test(line) || /^[A-D]\./i.test(line)) {
                options.push(line);
            } else if (/^(उत्तर|Answer):/i.test(line)) {
                const match = line.match(/\([A-D]\)|[A-D]/i);
                if (match) correctAns = match[0].replace(/[\(\)]/g, '').toUpperCase();
            } else if (/^(व्याख्या|Explanation):/i.test(line)) {
                explanation = line.replace(/^(व्याख्या|Explanation):/i, '').trim();
            } else {
                if (options.length === 0 && !/^(उत्तर|Answer|व्याख्या|Explanation):/i.test(line)) {
                    qText += ' ' + line;
                }
            }
        });

        if (qText && options.length >= 2) {
            questions.push({ question: qText, options: options, answer: correctAns, explanation: explanation });
        }
    });

    return questions.length > 0 ? questions : getMockParsedQuestions();
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

    if (appState.customTestsData[testId]) {
        appState.currentQuestions = parseTxtQuestions(appState.customTestsData[testId].rawTxt);
    } else {
        try {
            const res = await fetch(testMeta.file);
            const rawText = res.ok ? await res.text() : getFallbackTxtQuestions();
            appState.currentQuestions = parseTxtQuestions(rawText);
        } catch (e) {
            appState.currentQuestions = parseTxtQuestions(getFallbackTxtQuestions());
        }
    }

    appState.timeRemaining = appState.currentQuestions.length * (testMeta.timePerQuestion || 45);
    appState.timeSpent = 0;
    startTimer();
    renderQuestion(0);
    renderPalette();
}

function renderQuestion(index) {
    appState.currentQIndex = index;
    const q = appState.currentQuestions[index];
    document.getElementById('qCurrentIndex').textContent = index + 1;
    document.getElementById('qTotalCount').textContent = appState.currentQuestions.length;
    document.getElementById('qTextDisplay').innerHTML = `${index + 1}. ${q.question}`;

    const optsContainer = document.getElementById('optionsContainer');
    optsContainer.innerHTML = '';

    q.options.forEach((optText, optIdx) => {
        const optLetter = String.fromCharCode(65 + optIdx);
        const isChecked = appState.userAnswers[index] === optLetter;
        const optDiv = document.createElement('label');
        optDiv.className = 'option-item';
        optDiv.innerHTML = `<input type="radio" name="mcqOption" value="${optLetter}" ${isChecked ? 'checked' : ''} onchange="selectOption('${optLetter}')"><span>${optText}</span>`;
        optsContainer.appendChild(optDiv);
    });
    updatePaletteHighlight();
}

function selectOption(letter) { appState.userAnswers[appState.currentQIndex] = letter; updatePaletteHighlight(); }
function clearCurrentAnswer() { delete appState.userAnswers[appState.currentQIndex]; renderQuestion(appState.currentQIndex); }
function navigateQuestion(dir) { const next = appState.currentQIndex + dir; if (next >= 0 && next < appState.currentQuestions.length) renderQuestion(next); }

function renderPalette() {
    const grid = document.getElementById('paletteGrid');
    grid.innerHTML = '';
    appState.currentQuestions.forEach((_, idx) => {
        const btn = document.createElement('div');
        btn.className = 'p-num';
        btn.id = `palette-btn-${idx}`;
        btn.textContent = idx + 1;
        btn.onclick = () => renderQuestion(idx);
        grid.appendChild(btn);
    });
    updatePaletteHighlight();
}

function updatePaletteHighlight() {
    appState.currentQuestions.forEach((_, idx) => {
        const btn = document.getElementById(`palette-btn-${idx}`);
        if (!btn) return;
        btn.className = 'p-num';
        if (idx === appState.currentQIndex) btn.classList.add('current');
        else if (appState.userAnswers[idx]) btn.classList.add('answered');
        else btn.classList.add('unanswered');
    });
}

function startTimer() {
    clearInterval(appState.timerInterval);
    appState.timerInterval = setInterval(() => {
        appState.timeRemaining--;
        appState.timeSpent++;
        const m = Math.floor(appState.timeRemaining / 60);
        const s = appState.timeRemaining % 60;
        document.getElementById('timerDisplay').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (appState.timeRemaining <= 0) { clearInterval(appState.timerInterval); calculateAndShowResult(); }
    }, 1000);
}

function confirmSubmitTest() { if (confirm('टेस्ट सबमिट करें?')) { clearInterval(appState.timerInterval); calculateAndShowResult(); } }

function calculateAndShowResult() {
    document.getElementById('activeTestEngine').classList.add('hidden');
    document.getElementById('testResultView').classList.remove('hidden');
    let correct = 0, wrong = 0, attempted = 0;
    appState.currentQuestions.forEach((q, idx) => {
        if (appState.userAnswers[idx]) {
            attempted++;
            if (appState.userAnswers[idx] === q.answer) correct++; else wrong++;
        }
    });
    const score = (correct * (appState.currentTest.marks || 1)) - (wrong * (appState.currentTest.negativeMarking || 0));
    document.getElementById('resTestName').textContent = appState.currentTest.name;
    document.getElementById('resScore').textContent = score.toFixed(2);
    document.getElementById('resAccuracy').textContent = attempted > 0 ? ((correct/attempted)*100).toFixed(1)+'%' : '0%';
    document.getElementById('resAttempted').textContent = attempted;
    document.getElementById('resCorrect').textContent = correct;
    document.getElementById('resWrong').textContent = wrong;
    renderExplanations();
}

function renderExplanations() {
    const container = document.getElementById('explanationsContainer');
    container.innerHTML = '';
    appState.currentQuestions.forEach((q, idx) => {
        const uAns = appState.userAnswers[idx] || 'Not Attempted';
        const box = document.createElement('div');
        box.style.cssText = 'padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 10px; background: #fafafa; border-radius: 6px;';
        box.innerHTML = `<p><strong>Q${idx+1}: ${q.question}</strong></p><p>आपका उत्तर: ${uAns} | सही: <strong class="text-success">${q.answer}</strong></p><p>💡 ${q.explanation}</p>`;
        container.appendChild(box);
    });
}

function toggleDetailedExplanations() { document.getElementById('explanationsSection').classList.toggle('hidden'); }

function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`admin-tab-${tabId}`).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
}

function renderAdminTestTable() {
    const tbody = document.getElementById('adminTestTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    appState.testsIndex.forEach(t => {
        tbody.innerHTML += `<tr><td>${t.id}</td><td>${t.name}</td><td>${t.exam}</td><td>Published</td></tr>`;
    });
    document.getElementById('adminTotalTestsCount').textContent = appState.testsIndex.length;
    document.getElementById('adminTotalPdfsCount').textContent = appState.customPdfsData.length;
    renderAdminStudentsTable();
}

function handleDirectPasteTest(e) {
    e.preventDefault();
    const rawTxt = document.getElementById('adminRawTxtInput').value;
    const parsedQ = parseTxtQuestions(rawTxt);
    if (parsedQ.length === 0) return alert('कोई प्रश्न नहीं मिला।');
    const testId = document.getElementById('adminTestId').value.trim();
    const meta = {
        id: testId,
        name: document.getElementById('adminTestName').value,
        exam: document.getElementById('adminExamCat').value,
        category: "GS",
        subject: document.getElementById('adminSubject').value,
        file: `custom/${testId}`,
        questions: parsedQ.length,
        timePerQuestion: parseInt(document.getElementById('adminTimePerQ').value),
        marks: parseFloat(document.getElementById('adminMarks').value),
        negativeMarking: parseFloat(document.getElementById('adminNegMarks').value),
        published: true
    };
    appState.customTestsData[testId] = { meta, rawTxt };
    localStorage.setItem('gs_junction_custom_tests', JSON.stringify(appState.customTestsData));
    if (!appState.testsIndex.some(t => t.id === testId)) appState.testsIndex.unshift(meta);
    renderAdminTestTable();
    renderStudentTests('ALL');
    alert(`🎉 ${parsedQ.length} प्रश्नों वाला टेस्ट लाइव कर दिया गया है!`);
    toggleAuthRole();
    switchStudentTab('tests');
}

function handlePdfUpload(e) {
    e.preventDefault();
    const title = document.getElementById('adminPdfTitle').value;
    const fileInput = document.getElementById('adminPdfFilePicker');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Data = event.target.result;
            const pdfItem = { title: title, dataUrl: base64Data };
            
            appState.customPdfsData.unshift(pdfItem);
            localStorage.setItem('gs_junction_custom_pdfs', JSON.stringify(appState.customPdfsData));
            
            renderStudentPdfs();
            renderAdminTestTable();
            alert('🎉 PDF सफलतापर्वक अपलोड कर दी गई है!');
            document.getElementById('adminPdfTitle').value = '';
            fileInput.value = '';
            toggleAuthRole();
            switchStudentTab('notes');
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
}

function renderStudentPdfs() {
    const container = document.getElementById('pdfCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (appState.customPdfsData.length === 0) {
        container.innerHTML = `<p class="text-muted">अभी कोई PDF उपलब्ध नहीं है। (एडमिन पैनल से अपलोड करें)</p>`;
        return;
    }

    appState.customPdfsData.forEach((pdf, index) => {
        const card = document.createElement('div');
        card.className = 'test-card';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <i class="fa-solid fa-file-pdf text-danger" style="font-size: 2rem;"></i>
                <div>
                    <h4>${pdf.title}</h4>
                    <small class="text-muted">ऑनलाइन अध्ययन सामग्री</small>
                </div>
            </div>
            <button class="btn btn-primary" style="width: 100%;" onclick="openSecurePdf(${index})">
                <i class="fa-solid fa-book-open"></i> View & Read (पढ़ें)
            </button>
        `;
        container.appendChild(card);
    });
}

function openSecurePdf(index) {
    const pdf = appState.customPdfsData[index];
    if (!pdf) return;
    document.getElementById('viewingPdfTitle').textContent = pdf.title;
    document.getElementById('pdfFrame').src = pdf.dataUrl;
    document.getElementById('pdfViewerModal').classList.remove('hidden');
    window.scrollTo({ top: document.getElementById('pdfViewerModal').offsetTop, behavior: 'smooth' });
}

function closePdfViewer() {
    document.getElementById('pdfViewerModal').classList.add('hidden');
    document.getElementById('pdfFrame').src = '';
}

function saveBrandingSettings() {
    const newTitle = document.getElementById('brandTitleInput').value;
    const primaryCol = document.getElementById('primaryColorInput').value;
    document.getElementById('brandTitleText').textContent = newTitle;
    document.documentElement.style.setProperty('--primary-color', primaryCol);
    alert('ब्रांडिंग सेव हो गई है!');
}

function getFallbackTxtQuestions() {
    return `प्रश्न 1. भारतीय संविधान का अनुच्छेद 53 किससे संबंधित है?\n(A) राष्ट्रपति\n(B) प्रधानमंत्री\n(C) संसद\n(D) राज्यपाल\nउत्तर: (A)\nव्याख्या: संघ की कार्यपालिका शक्ति राष्ट्रपति में निहित होती है।`;
}
function getMockParsedQuestions() {
    return [{ question: "भारतीय संविधान का अनुच्छेद 53 किससे संबंधित है?", options: ["(A) राष्ट्रपति", "(B) प्रधानमंत्री", "(C) संसद", "(D) राज्यपाल"], answer: "A", explanation: "संघ की कार्यपालिका शक्ति राष्ट्रपति में निहित होती है।" }];
}
