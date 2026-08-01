let currentLineUserId = "";
let isSystemAdminExist = false; // システム管理者が存在するかどうかのフラグ

window.onload = async function() {
  try {
    // config.jsで設定したLIFF IDを使用
    await liff.init({ liffId: CONFIG.LIFF_ID });
    
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    const profile = await liff.getProfile();
    currentLineUserId = profile.userId;

    // LINEの表示名を申請者名の初期値としてセット
    const nameInput = document.getElementById("applicantName");
    if (nameInput) {
      nameInput.value = profile.displayName;
    }

    // サーバへステータス問い合わせ
    await fetchUserStatus(currentLineUserId);

  } catch (err) {
    console.error("初期化エラー:", err);
    showAppMessage("読み込みエラーが発生しました。", "error");
  }
};

/**
 * ステータス取得処理
 */
async function fetchUserStatus(lineUserId) {
  const url = `${CONFIG.GAS_WEB_APP_URL}?action=checkStatus&lineUserId=${encodeURIComponent(lineUserId)}`;

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.status === "success") {
      isSystemAdminExist = result.systemAdminExists;

      document.getElementById("status-display").innerText = 
        `現在の権限ステータス: ${result.role} / ${result.approvalStatus}`;

      // 「未登録」の場合はここでセレクトボックスを初期化し、登録カードを表示する
      if (result.role === "未登録") {
        initRoleSelect();
        document.getElementById("registration-card").classList.remove("hidden");
      }
    } else {
      showAppMessage("ステータスの取得に失敗しました。", "error");
    }
  } catch (err) {
    console.error("通信エラー:", err);
    showAppMessage("通信エラーが発生しました。", "error");
  }
}

/**
 * 権限のセレクトボックスを動的生成する
 * - システム管理者が未設定の場合: 「システム管理者」のみ表示
 * - システム管理者が設定済みの場合: 「利用禁止」を除外し、逆順で表示
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
 * 希望権限および申請種別の選択に応じて、フォーム項目の表示/非表示を制御する
 */
function handleRoleOrTypeChange() {
  const role = document.getElementById("role").value;
  const appTypeSelect = document.getElementById("applicationType");
  const appType = appTypeSelect ? appTypeSelect.value : "";

  const fieldAppType = document.getElementById("field-applicationType");
  const fieldTargetHousehold = document.getElementById("field-targetHouseholdId");
  const fieldKeyword = document.getElementById("field-keyword");

  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldTargetHousehold) fieldTargetHousehold.classList.add("hidden");
  if (fieldKeyword) fieldKeyword.classList.add("hidden");

  if (role === CONFIG.ROLES.SYSTEM_ADMIN) {
    if (fieldKeyword) fieldKeyword.classList.remove("hidden");
  }
  else if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN) {
    if (fieldAppType) fieldAppType.classList.remove("hidden");
    if (appType === "メンバー追加") {
      if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
    }
  } 
  else if (role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
    if (fieldTargetHousehold) fieldTargetHousehold.classList.remove("hidden");
  }
}

/**
 * 申請データの送信処理
 */
async function submitApplication(event) {
  event.preventDefault();

  const role = document.getElementById("role").value;
  const appTypeSelect = document.getElementById("applicationType");
  const targetHouseholdInput = document.getElementById("targetHouseholdId");
  const keywordInput = document.getElementById("adminKeyword");

  const payload = {
    action: "applyRole",
    lineUserId: currentLineUserId,
    applicantName: document.getElementById("applicantName").value,
    role: role,
    applicationType: (role === CONFIG.ROLES.HOUSEHOLD_ADMIN) ? appTypeSelect.value : "",
    targetHouseholdId: targetHouseholdInput ? targetHouseholdInput.value : "",
    keyword: (role === CONFIG.ROLES.SYSTEM_ADMIN) ? keywordInput.value : ""
  };

  try {
    setButtonState(true);
    const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === "success") {
      showAppMessage(`[${CONFIG.APP_NAME}] ${result.message}`, "success");
      setTimeout(() => location.reload(), 1500);
    } else {
      showAppMessage(`[${CONFIG.APP_NAME}] ${result.message}`, "error");
      setButtonState(false);
    }
  } catch (err) {
    console.error("送信エラー:", err);
    showAppMessage(`[${CONFIG.APP_NAME}] 送信中に通信エラーが発生しました。`, "error");
    setButtonState(false);
  }
}

/**
 * 画面内にアプリ名（改行）メッセージの形式で通知を表示するカスタム関数
 */
function showAppMessage(message, type = "error") {
  const msgBox = document.getElementById("app-message-box");
  if (!msgBox) {
    // 要素がない場合のフォールバック（alertの場合は \n で改行）
    alert(`${CONFIG.APP_NAME}\n${message}`);
    return;
  }

  // アプリ名を太字ブロックで表示し、その下に改行してメッセージを配置
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
