// 狀態管理：從 LocalStorage 讀取資料或初始化為空陣列
const STORAGE_KEY = 'sundaySchoolStudents';
const CLASS_NAME_KEY = 'sundaySchoolClassName';
let students = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// DOM 元素引用
const studentsList = document.getElementById('students-list');
const addStudentBtn = document.getElementById('add-student-btn');
const resetDataBtn = document.getElementById('reset-data-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const classDateInput = document.getElementById('class-date');
const searchStudentInput = document.getElementById('search-student');
const classNameInput = document.getElementById('class-name-input');

// Modal 與 Input 引用
const modalOverlay = document.getElementById('modal-overlay');
const addStudentModal = document.getElementById('add-student-modal');
const resetModal = document.getElementById('reset-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const qrSyncModal = document.getElementById('qr-sync-modal');
const qrDisplayModal = document.getElementById('qr-display-modal');
const qrScanModal = document.getElementById('qr-scan-modal');
const qrSyncBtn = document.getElementById('qr-sync-btn');
const generateQrBtn = document.getElementById('generate-qr-btn');
const scanQrBtn = document.getElementById('scan-qr-btn');
const qrcodeContainer = document.getElementById('qrcode-container');
const closeScanBtn = document.getElementById('close-scan-btn');
let html5QrcodeScanner = null;

const newStudentNameInput = document.getElementById('new-student-name');
const confirmAddStudentBtn = document.getElementById('confirm-add-student');
const confirmResetDataBtn = document.getElementById('confirm-reset-data');
const closeBtns = document.querySelectorAll('[data-close]');
const toastContainer = document.getElementById('toast-container');
const leaderboardTableBody = document.getElementById('leaderboard-table-body');

// 初始化
function init() {
    // 復原自訂班級名稱
    classNameInput.value = localStorage.getItem(CLASS_NAME_KEY) || '';

    // 設定預設日期為今天 (本地時間)
    const today = new Date();
    const localDate = today.toLocaleDateString('en-CA'); // format: YYYY-MM-DD
    classDateInput.value = localDate;

    // 渲染學生清單
    renderStudents();
    
    // 綁定事件監聽
    setupEventListeners();
}

// 根據過濾條件與當日日期，渲染學生列表
function renderStudents() {
    studentsList.innerHTML = '';
    const currentDate = classDateInput.value;
    const searchQuery = searchStudentInput.value.toLowerCase().trim();
    
    // 建立過濾後的陣列 (包含原始索引供事件綁定對照)
    const filteredStudents = students.map((st, idx) => ({ ...st, originalIndex: idx }))
                                     .filter(st => st.name.toLowerCase().includes(searchQuery));

    if (students.length === 0) {
        studentsList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px; background: rgba(255,255,255,0.4); border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.5;"></i>
                <p>目前尚無學生資料，請點擊上方按鈕新增學生。</p>
            </div>
        `;
        return;
    }

    if (filteredStudents.length === 0) {
        studentsList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px;">
                <p>找不到符合條件的學生</p>
            </div>
        `;
        return;
    }

    filteredStudents.forEach(student => {
        // 資料完整性確保
        if (!student.attendance) student.attendance = [];
        if (!student.points) student.points = 0;

        const attendanceCount = student.attendance.length;
        const totalScore = attendanceCount + student.points;
        const isPresentToday = currentDate ? student.attendance.includes(currentDate) : false;

        const card = document.createElement('div');
        card.className = 'student-card glass-panel';
        card.innerHTML = `
            <div class="student-header">
                <div class="student-name">${escapeHTML(student.name)}</div>
                <label class="checkbox-wrapper" title="勾選以標記出席">
                    <input type="checkbox" class="attendance-check" data-index="${student.originalIndex}" ${isPresentToday ? 'checked' : ''} ${!currentDate ? 'disabled' : ''}>
                    <div class="checkbox-custom"></div>
                    <span class="checkbox-label">出席</span>
                </label>
            </div>
            
            <div class="student-stats">
                <div class="stat-item">
                    <span class="stat-label">總次數</span>
                    <span class="stat-value" style="color: var(--primary);">${attendanceCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">點數</span>
                    <span class="stat-value" style="color: var(--success);">${student.points}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">總計</span>
                    <span class="stat-value">${totalScore}</span>
                </div>
            </div>

            <div class="student-actions">
                <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">調整點數：</span>
                <div class="points-control">
                    <button class="btn-icon decrease-pt" data-index="${student.originalIndex}" title="-1 點">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <span class="points-display">${student.points}</span>
                    <button class="btn-icon increase-pt" data-index="${student.originalIndex}" title="+1 點">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
        studentsList.appendChild(card);
    });

    // 動態綁定打卡狀態與點數操作的事件
    document.querySelectorAll('.attendance-check').forEach(checkbox => {
        checkbox.addEventListener('change', handleAttendanceToggle);
    });
    document.querySelectorAll('.increase-pt').forEach(btn => {
        btn.addEventListener('click', (e) => updatePoints(e.currentTarget.dataset.index, 1));
    });
    document.querySelectorAll('.decrease-pt').forEach(btn => {
        btn.addEventListener('click', (e) => updatePoints(e.currentTarget.dataset.index, -1));
    });
}

// 儲存資料
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

// 動態更新出席紀錄
function handleAttendanceToggle(e) {
    const isChecked = e.target.checked;
    const studentIndex = e.target.dataset.index;
    const selectedDate = classDateInput.value;
    
    if (!selectedDate) {
        showToast('請先選擇上課日期', 'error');
        e.target.checked = false;
        return;
    }

    const student = students[studentIndex];
    if (!student.attendance) student.attendance = [];

    const datePos = student.attendance.indexOf(selectedDate);

    if (isChecked) {
        if (datePos === -1) {
            student.attendance.push(selectedDate);
            showToast(`已登記 ${student.name} 的出席次數 (+1)`, 'success');
        }
    } else {
        if (datePos !== -1) {
            student.attendance.splice(datePos, 1);
            showToast(`已取消 ${student.name} 的出席次數 (-1)`, 'error'); // error style 用來表示撤銷，比較明顯
        }
    }
    
    saveData();
    renderStudents(); // 重新計算卡片分數與標籤狀態
}

// 點數增減邏輯
function updatePoints(index, delta) {
    if(students[index].points + delta < 0) {
        showToast('無法扣除，分數不能低於 0', 'error');
        return;
    }
    students[index].points += delta;
    saveData();
    renderStudents();
}

// 事件監聽總綁定
function setupEventListeners() {
    // 班級名稱自動儲存
    classNameInput.addEventListener('input', (e) => {
        localStorage.setItem(CLASS_NAME_KEY, e.target.value);
    });

    // QR 同步系統
    if (qrSyncBtn) qrSyncBtn.addEventListener('click', () => openModal(qrSyncModal));
    if (generateQrBtn) generateQrBtn.addEventListener('click', generateQR);
    if (scanQrBtn) scanQrBtn.addEventListener('click', startScanner);
    
    // 關閉相機
    if (closeScanBtn) {
        closeScanBtn.addEventListener('click', stopScannerAndClose);
    }

    // 更改日期時刷新畫面勾選狀態
    classDateInput.addEventListener('change', renderStudents);
    
    // 搜尋名單即時過濾
    searchStudentInput.addEventListener('input', renderStudents);

    // 新增學生
    addStudentBtn.addEventListener('click', () => {
        openModal(addStudentModal);
        newStudentNameInput.value = '';
        setTimeout(() => newStudentNameInput.focus(), 100);
    });
    confirmAddStudentBtn.addEventListener('click', handleAddStudent);
    newStudentNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddStudent();
    });

    // 開啟總分排行榜
    leaderboardBtn.addEventListener('click', openLeaderboard);

    // 系統年度歸零重置
    resetDataBtn.addEventListener('click', () => openModal(resetModal));
    confirmResetDataBtn.addEventListener('click', handleResetData);

    // Modal 關閉總控
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.currentTarget.getAttribute('data-close');
            closeModal(document.getElementById(modalId));
        });
    });

    // 點擊背景關閉 (不影響有特定操作的對話框，但為 UX 保留)
    modalOverlay.addEventListener('click', () => {
        closeModal(addStudentModal);
        closeModal(resetModal);
        closeModal(leaderboardModal);
    });
}

// 處理：新增學生
function handleAddStudent() {
    const name = newStudentNameInput.value.trim();
    if (!name) {
        showToast('請輸入學生姓名', 'error');
        return;
    }
    
    students.push({ name: name, attendance: [], points: 0 });
    saveData();
    
    // 清除搜尋框確保持新卡片顯露
    searchStudentInput.value = '';
    
    renderStudents();
    closeModal(addStudentModal);
    showToast(`成功新增學生：${name}`, 'success');
}

// 處理：生成總分查詢排行榜
function openLeaderboard() {
    // 重新結算並排列
    const rankedData = students.map(st => {
        const atCount = (st.attendance || []).length;
        const pt = st.points || 0;
        return {
            name: st.name,
            attendance: atCount,
            points: pt,
            total: atCount + pt
        };
    }).sort((a, b) => b.total - a.total); // 總分高至低

    leaderboardTableBody.innerHTML = '';
    
    if (rankedData.length === 0) {
        leaderboardTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">尚無學生資料</td></tr>`;
    } else {
        rankedData.forEach((st, idx) => {
            const rank = idx + 1;
            let rankClass = '';
            if (rank === 1) rankClass = 'rank-1';
            else if (rank === 2) rankClass = 'rank-2';
            else if (rank === 3) rankClass = 'rank-3';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="${rankClass}">${rank}</td>
                <td>${escapeHTML(st.name)}</td>
                <td>${st.attendance}</td>
                <td>${st.points}</td>
                <td style="font-weight:bold; color:var(--primary);">${st.total}</td>
            `;
            leaderboardTableBody.appendChild(tr);
        });
    }

    openModal(leaderboardModal);
}

// 處理：年度重置
function handleResetData() {
    students = students.map(st => {
        return {
            name: st.name,
            attendance: [], 
            points: 0     
        };
    });
    saveData();
    renderStudents();
    closeModal(resetModal);
    showToast('年度資料已全面重置歸零', 'success');
}

// Modal 控制邏輯
function openModal(modal) {
    modalOverlay.classList.add('active');
    modal.classList.add('active');
}

function closeModal(modal) {
    if(modal) modal.classList.remove('active');
    modalOverlay.classList.remove('active');
}

// 工具防 XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

// 工具：Toast 自動關閉通知
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconClass = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
    
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); 
    }, 2800);
}

// 啟動程式
document.addEventListener('DOMContentLoaded', init);

// ====== 離線同步與 QR 邏輯 ======

// 產生 QR Code
function generateQR() {
    if (!students || students.length === 0) {
        showToast('目前尚無資料可供分享', 'error');
        return;
    }

    closeModal(qrSyncModal);
    openModal(qrDisplayModal);
    
    // 清空舊容器
    qrcodeContainer.innerHTML = '';
    
    // 產出簡短的資料承載陣列 [name, attendance[], points]
    const payload = JSON.stringify({
        cls: classNameInput.value,
        data: students.map(s => [s.name, s.attendance, s.points])
    });

    try {
        new QRCode(qrcodeContainer, {
            text: payload,
            width: 280,
            height: 280,
            colorDark : "#0f172a",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.L
        });
    } catch (e) {
        showToast('資料量溢出，QR 產生失敗。請聯繫開發者進行分頁處理', 'error');
    }
}

// 啟動相機掃描
function startScanner() {
    closeModal(qrSyncModal);
    openModal(qrScanModal);
    
    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        showToast('無法存取鏡頭，請確認瀏覽器相機權限', 'error');
    });
}

function stopScannerAndClose() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            closeModal(qrScanModal);
        }).catch(err => closeModal(qrScanModal));
    } else {
        closeModal(qrScanModal);
    }
}

// 掃描成功解碼處理 (資料 Merge 機制)
function onScanSuccess(decodedText) {
    stopScannerAndClose(); 
    
    try {
        const payload = JSON.parse(decodedText);
        if (!payload.data || !Array.isArray(payload.data)) throw new Error("Format Invalid");
        
        let mergedCount = 0;
        let addedCount = 0;

        payload.data.forEach(item => {
            const [pName, pAtt, pPts] = item;
            let existingStudent = students.find(s => s.name === pName);
            
            if (existingStudent) {
                // 出席日期交集並合併
                const mergedAtt = new Set([...existingStudent.attendance, ...pAtt]);
                existingStudent.attendance = Array.from(mergedAtt);
                
                // 點數以雙方中較高的為準（避免覆蓋）
                existingStudent.points = Math.max(existingStudent.points, pPts);
                mergedCount++;
            } else {
                students.push({
                    name: pName,
                    attendance: pAtt,
                    points: pPts
                });
                addedCount++;
            }
        });

        // 協助同步班級名稱
        if (payload.cls && !classNameInput.value) {
            classNameInput.value = payload.cls;
            localStorage.setItem(CLASS_NAME_KEY, payload.cls);
        }

        saveData();
        renderStudents();
        showToast(`掃描成功！覆蓋 ${mergedCount} 筆，新增 ${addedCount} 筆學生紀錄`, 'success');
        
    } catch (error) {
        showToast('無法解析此條碼，可能來源非點名系統', 'error');
    }
}
