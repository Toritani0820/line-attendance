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

    // サーバへステータス問い合わせ（ここでシステムの有無が判定され、未登録ならセレクトボックス生成へ進む）
    await fetchUserStatus(currentLineUserId);

  } catch (err) {
    console.error("初期化エラー:", err);
    document.getElementById("status-display").innerText = "読み込みエラーが発生しました。";
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
      // サーバーから返されたシステム管理者の有無を保持
      isSystemAdminExist = result.systemAdminExists;

      document.getElementById("status-display").innerText = 
        `現在の権限ステータス: ${result.role} / ${result.approvalStatus}`;

      // 「未登録」の場合はここでセレクトボックスを初期化し、登録カードを表示する
      if (result.role === "未登録") {
        initRoleSelect();
        document.getElementById("registration-card").classList.remove("hidden");
      }
    } else {
      document.getElementById("status-display").innerText = "ステータスの取得に失敗しました。";
    }
  } catch (err) {
    console.error("通信エラー:", err);
    document.getElementById("status-display").innerText = "通信エラーが発生しました。";
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
    // システム管理者がまだ誰もいない場合 ➔ 「システム管理者」のみ
    const option = document.createElement("option");
    option.value = CONFIG.ROLES.SYSTEM_ADMIN;
    option.textContent = CONFIG.ROLES.SYSTEM_ADMIN;
    roleSelect.appendChild(option);
  } else {
    // システム管理者が既にいる場合 ➔ 利用禁止を除外し、逆順
    const entries = Object.entries(CONFIG.ROLES).reverse();

    for (const [key, value] of entries) {
      if (value === CONFIG.ROLES.BANNED) continue;

      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      roleSelect.appendChild(option);
    }
  }

  // 初期ロード時にも表示制御を適用
  handleRoleOrTypeChange();
}

/**
 * 希望権限および申請種別の選択に応じて、フォーム項目の表示/非表示を制御する
 */
function handleRoleOrTypeChange() {
  const role = document.getElementById("role").value;
  const appTypeSelect = document.getElementById("applicationType");
  const appType = appTypeSelect ? appTypeSelect.value : "";

  // 各フィールドの要素
  const fieldAppType = document.getElementById("field-applicationType");
  const fieldTargetHousehold = document.getElementById("field-targetHouseholdId");
  const fieldKeyword = document.getElementById("field-keyword");

  // いったんすべて非表示にする
  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldTargetHousehold) fieldTargetHousehold.classList.add("hidden");
  if (fieldKeyword) fieldKeyword.classList.add("hidden");

  // 権限ごとの表示制御
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

  // バックエンドへ送信するペイロードの構築
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
      alert(result.message);
      location.reload();
    } else {
      alert("エラー: " + result.message);
      setButtonState(false);
    }
  } catch (err) {
    console.error("送信エラー:", err);
    alert("送信中に通信エラーが発生しました。");
    setButtonState(false);
  }
}

function setButtonState(disabled) {
  const btn = document.querySelector("button[type='submit']");
  if (btn) btn.disabled = disabled;
}
