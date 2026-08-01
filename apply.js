let currentLineUserId = "";
let currentLineDisplayName = "";
let isSystemAdminExist = false;

window.onload = async function() {
  try {
    // 1. LIFF初期化
    await liff.init({ liffId: CONFIG.LIFF_ID });
    
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    // 2. プロフィール情報の取得
    const profile = await liff.getProfile();
    currentLineUserId = profile.userId;
    currentLineDisplayName = profile.displayName || "LINEユーザー";

    // 3. LINE表示名を画面の入力欄にセット
    const displayNameInput = document.getElementById("lineDisplayName");
    if (displayNameInput) {
      displayNameInput.value = currentLineDisplayName;
    }

    // 4. 氏名の初期値にLINE表示名をセット（未入力の場合のみ）
    const fullNameInput = document.getElementById("fullName");
    if (fullNameInput && !fullNameInput.value) {
      fullNameInput.value = currentLineDisplayName;
    }

    // 5. ユーザーの現在のステータスを確認
    await fetchUserStatus(currentLineUserId);

  } catch (err) {
    console.error("初期化エラー:", err);
    showAppMessage("初期化に失敗しました: " + err.message, "error");
  }
};

/**
 * ユーザーの登録状況・権限ステータスを取得する
 */
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

      // 未登録の場合のみ申請フォームを表示
      if (result.role === "未登録") {
        initRoleSelect();
        const regCard = document.getElementById("registration-card");
        if (regCard) regCard.classList.remove("hidden");
      }
    } else {
      showAppMessage("ステータスの取得に失敗しました: " + result.message, "error");
    }
  } catch (err) {
    console.error("通信エラー:", err);
    showAppMessage("ステータス取得時の通信エラー: " + err.message, "error");
  }
}

/**
 * 希望権限のセレクトボックス初期化
 */
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
 * 選択された権限・申請種別に応じて入力欄の表示/非表示を切り替える
 */
function handleRoleOrTypeChange() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect) return;
  const role = roleSelect.value;

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

/**
 * 申請ボタン押下時の処理
 */
async function submitApplication(event) {
  event.preventDefault();

  const roleSelect = document.getElementById("role");
  const role = roleSelect ? roleSelect.value : "";
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
    return;
  }

  try {
    setButtonState(true);

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
    showAppMessage("送信中に通信エラーが発生しました: " + err.message, "error");
    setButtonState(false);
  }
}

/**
 * メッセージ表示用関数
 */
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

/**
 * 送信ボタンの有効・無効切り替え
 */
function setButtonState(disabled) {
  const btn = document.querySelector("button[type='submit']");
  if (btn) btn.disabled = disabled;
}
