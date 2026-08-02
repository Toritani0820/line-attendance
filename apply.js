let currentLineUserId = "";
let currentLineDisplayName = "";
let isSystemAdminExist = false;
let isAlreadyRegistered = false; // ★追加：既存登録済みフラグ

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

    // LINE表示名の欄に値をセット（読み取り専用）
    const displayNameInput = document.getElementById("lineDisplayName");
    if (displayNameInput) {
      displayNameInput.value = currentLineDisplayName;
    }

    // 氏名欄は空のままにする
    const fullNameInput = document.getElementById("fullName");
    if (fullNameInput && !fullNameInput.value) {
      fullNameInput.value = "";
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

      if (result.role === "未登録") {
        // 初回登録の場合
        isAlreadyRegistered = false;
        initRoleSelect();
        if (regCard) regCard.classList.remove("hidden");
      } else {
        // ★すでに登録済みの場合：追加申請モードとして有効化
        isAlreadyRegistered = true;
        initAdditionalApplyMode();
        if (regCard) regCard.classList.remove("hidden");
      }
    } else {
      showAppMessage("ステータス取得エラー: " + result.message, "error");
    }
  } catch (err) {
    console.error("通信エラー:", err);
    showAppMessage("ステータス取得時の通信に失敗しました:\n" + err.message, "error");
  }
}

// 初回登録用のロールセレクト初期化
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

// ★追加申請モード時の初期化（追加時は「予定回答者」に固定）
function initAdditionalApplyMode() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect || !CONFIG.ROLES) return;

  roleSelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = CONFIG.ROLES.RESPONDENT;
  option.textContent = "予定回答者（追加申請）";
  roleSelect.appendChild(option);
  roleSelect.disabled = true; // 変更不可に固定

  // カードのタイトルなどを「追加申請」用に変更する配慮
  const formTitle = document.querySelector("#registration-card h3");
  if (formTitle) {
    formTitle.textContent = "別世帯への追加参加申請（予定回答者）";
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

  // 1. まずすべての条件付きフィールドを非表示にする
  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldTargetHousehold) fieldTargetHousehold.classList.add("hidden");
  if (fieldHouseholdName) fieldHouseholdName.classList.add("hidden");
  if (fieldKeyword) fieldKeyword.classList.add("hidden");

  // 2. 状態に応じた表示制御
  if (isAlreadyRegistered) {
    // 既存登録済みの場合は「世帯ID」と、後述する「備考欄」を表示する
    if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
  } else {
    // 初回登録時の制御
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
}

async function submitApplication() {
  const roleSelect = document.getElementById("role");
  const role = roleSelect ? roleSelect.value : "";
  const appTypeSelect = document.getElementById("applicationType");
  const targetHouseholdInput = document.getElementById("targetHouseholdId");
  const householdNameInput = document.getElementById("householdName");
  const keywordInput = document.getElementById("adminKeyword");
  const noteInput = document.getElementById("note"); // ★追加：備考欄要素（HTML側に要追加）
  
  const fullNameInput = document.getElementById("fullName");
  const fullName = fullNameInput ? fullNameInput.value.trim() : "";

  if (!fullName) {
    showAppMessage("氏名を入力してください。", "error");
    return;
  }

  // 世帯IDの入力チェック
  if (isAlreadyRegistered || role === CONFIG.ROLES.HOUSEHOLD_ADMIN || role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
    if (targetHouseholdInput && !targetHouseholdInput.value.trim()) {
      showAppMessage("世帯IDを入力してください。", "error");
      return;
    }
  }

  // 新規登録時は世帯名も必須
  if (!isAlreadyRegistered && role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect && appTypeSelect.value === "新規登録") {
    if (householdNameInput && !householdNameInput.value.trim()) {
      showAppMessage("世帯名を入力してください。", "error");
      return;
    }
  }

  if (!isAlreadyRegistered && role === CONFIG.ROLES.SYSTEM_ADMIN && keywordInput && !keywordInput.value.trim()) {
    showAppMessage("システム管理者キーワードを入力してください。", "error");
    return;
  }

  const payload = {
    action: "applyRole",
    lineUserId: currentLineUserId,
    lineDisplayName: currentLineDisplayName,
    fullName: fullName,
    role: role,
    applicationType: (!isAlreadyRegistered && role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect) ? appTypeSelect.value : "",
    targetHouseholdId: targetHouseholdInput ? targetHouseholdInput.value.trim() : "",
    householdName: (!isAlreadyRegistered && role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect && appTypeSelect.value === "新規登録" && householdNameInput) ? householdNameInput.value.trim() : "",
    keyword: (!isAlreadyRegistered && role === CONFIG.ROLES.SYSTEM_ADMIN && keywordInput) ? keywordInput.value.trim() : "",
    note: noteInput ? noteInput.value.trim() : "" // ★追加：備考パラメータ
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
