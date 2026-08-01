let currentLineUserId = "";
let currentLineDisplayName = "";
let isSystemAdminExist = false;

// 【重要】ページ読み込み時に、LIFFの成否に関わらずイベントを確実に即座にバインドする
window.onload = function() {
  setupEventListeners();
  initializeApp();
};

/**
 * ボタンやセレクトボックスのイベント監視を確実に設定する
 */
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

/**
 * LINE初期化およびユーザーデータの非同期取得
 */
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

    try {
      const profile = await liff.getProfile();
      currentLineUserId = profile.userId;
      currentLineDisplayName = profile.displayName || "LINEユーザー";
    } catch (profileErr) {
      console.warn("プロフィール取得フォールバック:", profileErr);
      currentLineUserId = "USER_" + Date.now();
      currentLineDisplayName = "LINEユーザー";
    }

    const displayNameInput = document.getElementById("lineDisplayName");
    if (displayNameInput) {
      displayNameInput.value = currentLineDisplayName;
    }

    const fullNameInput = document.getElementById("fullName");
    if (fullNameInput && !fullNameInput.value) {
      fullNameInput.value = currentLineDisplayName;
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
    const result = await response.json();

    if (result.status === "success") {
      isSystemAdminExist = result.systemAdminExists;

      const statusDisplay = document.getElementById("status-display");
      if (statusDisplay) {
        statusDisplay.innerText = `現在の権限ステータス: ${result.role} / ${result.approvalStatus}`;
      }

      if (result.role === "未登録") {
        initRoleSelect();
        const regCard = document.getElementById("registration-card");
        if (regCard) regCard.classList.remove("hidden");
      }
    } else {
      showAppMessage("ステータス取得エラー: " + result.message, "error");
    }
  } catch (err) {
    console.error("通信エラー:", err);
    showAppMessage("ステータス取得時の通信に失敗しました。", "error");
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

/**
 * 選択された権限・申請種別に応じた入力欄の表示/非表示制御
 */
function handleRoleOrTypeChange() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect) return;
  const role = roleSelect.value;

  const appTypeSelect = document.getElementById("applicationType");
  const appType = appTypeSelect ? appTypeSelect.value : "";

  const fieldFullName = document.getElementById("field-fullName");
  const fieldAppType = document.getElementById("field-applicationType");
  const fieldTargetHousehold = document.getElementById("field-targetHouseholdId");
  const fieldHouseholdName = document.getElementById("field-householdName");
  const fieldKeyword = document.getElementById("field-keyword");

  if (fieldFullName) fieldFullName.classList.add("hidden");
  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldTargetHousehold) fieldTargetHousehold.classList.add("hidden");
  if (fieldHouseholdName) fieldHouseholdName.classList.add("hidden");
  if (fieldKeyword) fieldKeyword.classList.add("hidden");

  if (role === CONFIG.ROLES.SYSTEM_ADMIN) {
    if (fieldKeyword) fieldKeyword.classList.remove("hidden");
  }
  else {
    if (fieldFullName) fieldFullName.classList.remove("hidden");

    if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN) {
      if (fieldAppType) fieldAppType.classList.remove("hidden");
      
      if (appType === "新規登録") {
        if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
        if (fieldHouseholdName) fieldHouseholdName.classList.remove("hidden");
      } else if (appType === "管理者追加") {
        if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
      }
    } 
    else if (role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
      if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
    }
  }
}

/**
 * 申請ボタン押下時の処理とバリデーション
 */
async function submitApplication() {
  const roleSelect = document.getElementById("role");
  const role = roleSelect ? roleSelect.value : "";
  const appTypeSelect = document.getElementById("applicationType");
  const fullNameInput = document.getElementById("fullName");
  const targetHouseholdInput = document.getElementById("targetHouseholdId");
  const householdNameInput = document.getElementById("householdName");
  const keywordInput = document.getElementById("adminKeyword");

  const fullNameValue = (role === CONFIG.ROLES.SYSTEM_ADMIN) 
    ? currentLineDisplayName 
    : (fullNameInput ? fullNameInput.value.trim() : "");

  const payload = {
    action: "applyRole",
    lineUserId: currentLineUserId,
    lineDisplayName: currentLineDisplayName,
    fullName: fullNameValue,
    role: role,
    applicationType: (role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect) ? appTypeSelect.value : "",
    targetHouseholdId: targetHouseholdInput ? targetHouseholdInput.value.trim() : "",
    householdName: (role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect && appTypeSelect.value === "新規登録" && householdNameInput) ? householdNameInput.value.trim() : "",
    keyword: (role === CONFIG.ROLES.SYSTEM_ADMIN && keywordInput) ? keywordInput.value.trim() : ""
  };

  if (role === CONFIG.ROLES.SYSTEM_ADMIN) {
    if (!payload.keyword) {
      showAppMessage("システム管理者キーワードを入力してください。", "error");
      return;
    }
  } else {
    if (!payload.fullName) {
      showAppMessage("氏名を入力してください。", "error");
      return;
    }
  }

  try {
    const btn = document.getElementById("submit-btn");
    if (btn) btn.disabled = true;

    const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();

    if (result.status === "success") {
      showAppMessage(result.message, "success");
      setTimeout(() => location.reload(), 1500);
    } else {
      showAppMessage(result.message, "error");
      if (btn) btn.disabled = false;
    }
  } catch (err) {
    console.error("送信エラー:", err);
    showAppMessage("送信中に通信エラーが発生しました。", "error");
    const btn = document.getElementById("submit-btn");
    if (btn) btn.disabled = false;
  }
}

function showAppMessage(message, type = "error") {
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
