let currentLineUserId = "";
let currentLineDisplayName = "";
let isSystemAdminExist = false;

window.onload = async function() {
  try {
    if (typeof CONFIG === 'undefined') {
      showAppMessage("config.js が読み込まれていません。設定を確認してください。", "error");
      return;
    }

    // LIFF初期化
    await liff.init({ liffId: CONFIG.LIFF_ID });
    
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    const profile = await liff.getProfile();
    currentLineUserId = profile.userId;
    currentLineDisplayName = profile.displayName || "LINEユーザー";

    setProfileToUI(currentLineDisplayName);
    await fetchUserStatus(currentLineUserId);

  } catch (err) {
    console.warn("LIFF初期化に失敗しました（通常ブラウザモードで動作中）：", err);
    
    // ※ブラウザ単体でテストしている場合のフォールバック（テスト用ID・名前を設定）
    currentLineUserId = "TEST_USER_" + Date.now();
    currentLineDisplayName = "テストユーザー（ブラウザ）";
    
    setProfileToUI(currentLineDisplayName + " ※要LINE環境");
    showAppMessage("LIFF環境外で動作しています。テストモードとして動作します。", "error");

    try {
      await fetchUserStatus(currentLineUserId);
    } catch (e) {
      console.error("ステータス取得失敗:", e);
    }
  }
};

/**
 * 画面の入力欄にLINE表示名や氏名をセットする補助関数
 */
function setProfileToUI(displayName) {
  const displayNameInput = document.getElementById("lineDisplayName");
  if (displayNameInput) {
    displayNameInput.value = displayName;
  }

  const fullNameInput = document.getElementById("fullName");
  if (fullNameInput && !fullNameInput.value) {
    // LINE表示名を氏名の初期値に設定（変更可能）
    fullNameInput.value = displayName.replace(" ※要LINE環境", "");
  }
}

async function fetchUserStatus(lineUserId) {
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
    showAppMessage("ステータスの取得に失敗しました: " + result.message, "error");
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
  const roleElement = document.getElementById("role");
  if (!roleElement) return;
  const role = roleElement.value;

  const appTypeSelect = document.getElementById("applicationType");
  const appType = appTypeSelect ? appTypeSelect.value : "";

  const fieldAppType = document.getElementById("field-applicationType");
  const fieldTargetHousehold = document.getElementById("field-targetHouseholdId");
  const fieldHouseholdName = document.getElementById("field-householdName");
  const fieldKeyword = document.getElementById("field-keyword");

  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldTargetHousehold) fieldTargetHousehold.classList.add("hidden");
  if (fieldHouseholdName) fieldHouseholdName.classList.add("hidden");
  if (fieldKeyword) fieldKeyword.classList.add("hidden");

  if (role === CONFIG.ROLES.SYSTEM_ADMIN) {
    if (fieldKeyword) fieldKeyword.classList.remove("hidden");
  }
  else if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN) {
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

async function submitApplication(event) {
  event.preventDefault();

  try {
    setButtonState(true);

    const roleElement = document.getElementById("role");
    const role = roleElement ? roleElement.value : "";
    const appTypeSelect = document.getElementById("applicationType");
    const fullNameInput = document.getElementById("fullName");
    const targetHouseholdInput = document.getElementById("targetHouseholdId");
    const householdNameInput = document.getElementById("householdName");
    const keywordInput = document.getElementById("adminKeyword");

    const payload = {
      action: "applyRole",
      lineUserId: currentLineUserId,
      lineDisplayName: currentLineDisplayName,
      fullName: fullNameInput ? fullNameInput.value.trim() : "",
      role: role,
      applicationType: (role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect) ? appTypeSelect.value : "",
      targetHouseholdId: targetHouseholdInput ? targetHouseholdInput.value.trim() : "",
      householdName: (role === CONFIG.ROLES.HOUSEHOLD_ADMIN && appTypeSelect && appTypeSelect.value === "新規登録" && householdNameInput) ? householdNameInput.value.trim() : "",
      keyword: (role === CONFIG.ROLES.SYSTEM_ADMIN && keywordInput) ? keywordInput.value.trim() : ""
    };

    if (!payload.fullName) {
      showAppMessage("氏名を入力してください。", "error");
      setButtonState(false);
      return;
    }

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
      setButtonState(false);
    }
  } catch (err) {
    console.error("送信エラー:", err);
    showAppMessage("送信中にエラーが発生しました: " + err.message, "error");
    setButtonState(false);
  }
}

function showAppMessage(message, type = "error") {
  const msgBox = document.getElementById("app-message-box");
  if (!msgBox) {
    alert(`${CONFIG.APP_NAME}\n${message}`);
    return;
  }

  msgBox.innerHTML = `<strong class="block font-bold mb-1">${CONFIG.APP_NAME}</strong><span class="block">${message}</span>`;
  msgBox.classList.remove("hidden");

  if (type === "success") {
    msgBox.className = "p-3 mb-4 rounded text-sm bg-green-100 text-green-700";
  } else {
    msgBox.className = "p-3 mb-4 rounded text-sm bg-red-100 text-red-700";
  }
}

function setButtonState(disabled) {
  const btn = document.querySelector("button[type='submit']");
  if (btn) btn.disabled = disabled;
}
