let currentLineUserId = "";
let currentLineDisplayName = "";
let isSystemAdminExist = false;
let isAlreadyRegistered = false;

window.onload = function() {
  setupEventListeners();
  initializeApp();
};

function setupEventListeners() {
  const roleSelect = document.getElementById("role");
  if (roleSelect) {
    roleSelect.addEventListener("change", handleRoleOrTypeChange);
  }

  const appTypeSelect = document.getElementById("applicationType");
  if (appTypeSelect) {
    appTypeSelect.addEventListener("change", handleRoleOrTypeChange);
  }

  const submitBtn = document.getElementById("submit-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitApplication);
  }
}

async function initializeApp() {
  try {
    if (typeof CONFIG === 'undefined') {
      showAppMessage("config.js が読み込まれていません。", "error");
      return;
    }

    await liff.init({ liffId: CONFIG.LIFF_ID });
    
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    const profile = await liff.getProfile();
    currentLineUserId = profile.userId;
    currentLineDisplayName = profile.displayName || "LINEユーザー";

    const displayNameInput = document.getElementById("lineDisplayName");
    if (displayNameInput) {
      displayNameInput.value = currentLineDisplayName;
    }

    await fetchUserStatus(currentLineUserId);

  } catch (err) {
    console.error("初期化エラー:", err);
    showAppMessage("初期化に失敗しました: " + err.message, "error");
  }
}

async function fetchUserStatus(lineUserId) {
  try {
    const url = `${CONFIG.GAS_WEB_APP_URL}?action=checkStatus&lineUserId=${encodeURIComponent(lineUserId)}`;
    const response = await fetch(url);
    const responseText = await response.text();
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      throw new Error("サーバーからの応答形式が不正です:\n" + responseText);
    }

    if (result.status === "success") {
      isSystemAdminExist = result.systemAdminExists;

      const statusDisplay = document.getElementById("status-display");
      if (statusDisplay) {
        statusDisplay.innerText = `現在の権限ステータス: ${result.role} / ${result.approvalStatus}`;
      }

      const regCard = document.getElementById("registration-card");
      const scheduleArea = document.getElementById("schedule-area");
      const fullNameInput = document.getElementById("fullName");

      if (result.role === "未登録") {
        // ① 未登録の場合：新規登録フォームを表示
        isAlreadyRegistered = false;
        if (regCard) regCard.classList.remove("hidden");
        if (scheduleArea) scheduleArea.classList.add("hidden");
        
        if (fullNameInput) {
          fullNameInput.value = "";
          fullNameInput.readOnly = false;
        }
        initRoleSelect();
      } 
      else if (result.approvalStatus === "申請中") {
        // ② 申請中の場合：承認待ちメッセージを表示し、フォームは非表示
        if (regCard) regCard.classList.add("hidden");
        if (scheduleArea) scheduleArea.classList.add("hidden");
        showAppMessage("現在、管理者の承認待ちです。承認されるまでしばらくお待ちください。", "success");
      } 
      else if (result.approvalStatus === "承認済") {
        // ③ 承認済みの場合：申請画面を隠し、スケジュール機能エリアを表示する
        isAlreadyRegistered = true;
        if (regCard) regCard.classList.add("hidden");
        if (scheduleArea) scheduleArea.classList.remove("hidden");

        // 必要に応じてスケジュールデータの取得関数等をここで実行
      } 
      else {
        if (regCard) regCard.classList.add("hidden");
        if (scheduleArea) scheduleArea.classList.add("hidden");
      }
    } else {
      showAppMessage("ステータス取得エラー: " + result.message, "error");
    }
  } catch (err) {
    console.error("通信エラー:", err);
    showAppMessage("ステータス取得時の通信に失敗しました:\n" + err.message, "error");
  }
}

function initRoleSelect() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect || !CONFIG.ROLES) return;

  roleSelect.innerHTML = "";

  if (!isSystemAdminExist) {
    const option = document.createElement("option");
    option.value = CONFIG.ROLES.SYSTEM_ADMIN;
    option.textContent = CONFIG.ROLES.SYSTEM_ADMIN;
    roleSelect.appendChild(option);
  } else {
    const entries = Object.entries(CONFIG.ROLES).reverse();
    for (const [key, value] of entries) {
      if (value === CONFIG.ROLES.BANNED) continue;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      roleSelect.appendChild(option);
    }
  }

  handleRoleOrTypeChange();
}

function handleRoleOrTypeChange() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect) return;
  const role = roleSelect.value;

  const appTypeSelect = document.getElementById("applicationType");
  const fieldAppType = document.getElementById("field-applicationType");
  const fieldTargetHousehold = document.getElementById("field-targetHouseholdId");
  const fieldHouseholdName = document.getElementById("field-householdName");
  const fieldKeyword = document.getElementById("field-keyword");
  const fieldNote = document.getElementById("field-note");

  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldTargetHousehold) fieldTargetHousehold.classList.add("hidden");
  if (fieldHouseholdName) fieldHouseholdName.classList.add("hidden");
  if (fieldKeyword) fieldKeyword.classList.add("hidden");
  if (fieldNote) fieldNote.classList.add("hidden");

  // 初回登録時の条件分岐
  if (role === CONFIG.ROLES.SYSTEM_ADMIN) {
    if (fieldKeyword) fieldKeyword.classList.remove("hidden");
  }
  else if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN) {
    if (fieldAppType) fieldAppType.classList.remove("hidden");
    if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
    
    if (appTypeSelect && appTypeSelect.value === "新規登録") {
      if (fieldHouseholdName) fieldHouseholdName.classList.remove("hidden");
    }
  } 
  else if (role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
    if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
  }
}

async function submitApplication() {
  const roleSelect = document.getElementById("role");
  const role = roleSelect ? roleSelect.value : "";
  const appTypeSelect = document.getElementById("applicationType");
  const targetHouseholdInput = document.getElementById("targetHouseholdId");
  const householdNameInput = document.getElementById("householdName");
  const keywordInput = document.getElementById("adminKeyword");
  const noteInput = document.getElementById("note");
  
  const fullNameInput = document.getElementById("fullName");
  const fullName = fullNameInput ? fullNameInput.value.trim() : "";

  if (!fullName) {
    showAppMessage("氏名を入力してください。", "error");
    return;
  }

  if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN || role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
    if (targetHouseholdInput && !targetHouseholdInput.value.trim()) {
      showAppMessage("世帯IDを入力してください。", "error");
      return;
    }
  }

  if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect && appTypeSelect.value === "新規登録") {
    if (householdNameInput && !householdNameInput.value.trim()) {
      showAppMessage("世帯名を入力してください。", "error");
      return;
    }
  }

  if (role === CONFIG.ROLES.SYSTEM_ADMIN && keywordInput && !keywordInput.value.trim()) {
    showAppMessage("システム管理者キーワードを入力してください。", "error");
    return;
  }

  const payload = {
    action: "applyRole",
    lineUserId: currentLineUserId,
    lineDisplayName: currentLineDisplayName,
    fullName: fullName,
    role: role,
    applicationType: (role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect) ? appTypeSelect.value : "",
    targetHouseholdId: targetHouseholdInput ? targetHouseholdInput.value.trim() : "",
    householdName: (role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect && appTypeSelect.value === "新規登録" && householdNameInput) ? householdNameInput.value.trim() : "",
    keyword: (role === CONFIG.ROLES.SYSTEM_ADMIN && keywordInput) ? keywordInput.value.trim() : "",
    note: noteInput ? noteInput.value.trim() : ""
  };

  try {
    const btn = document.getElementById("submit-btn");
    if (btn) btn.disabled = true;

    const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      throw new Error("サーバーからの応答形式が不正です:\n" + responseText);
    }

    if (result.status === "success") {
      showAppMessage(result.message, "success");
      setTimeout(() => location.reload(), 1500);
    } else {
      showAppMessage(result.message, "error");
      if (btn) btn.disabled = false;
    }
  } catch (err) {
    console.error("送信エラー:", err);
    showAppMessage("通信エラーが発生しました:\n" + err.message, "error");
    const btn = document.getElementById("submit-btn");
    if (btn) btn.disabled = false;
  }
}

function showAppMessage(message, type = "error") {
  alert(message);

  const msgBox = document.getElementById("app-message-box");
  if (!msgBox) return;

  msgBox.innerHTML = `<span class="block">${message}</span>`;
  msgBox.classList.remove("hidden");

  if (type === "success") {
    msgBox.className = "p-3 mb-4 rounded text-sm bg-green-100 text-green-700";
  } else {
    msgBox.className = "p-3 mb-4 rounded text-sm bg-red-100 text-red-700";
  }
}
