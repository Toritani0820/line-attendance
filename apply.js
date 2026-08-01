let currentLineUserId = "";

window.onload = async function() {
  try {
    // config.jsで定義された権限からセレクトボックスを動的生成
    initRoleSelect();

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
    document.getElementById("status-display").innerText = "読み込みエラーが発生しました。";
  }
};

/**
 * config.jsの定義から希望権限のセレクトボックスを逆順で生成する
 */
function initRoleSelect() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect || !CONFIG.ROLES) return;

  roleSelect.innerHTML = "";

  // 定義のエントリ配列を取得し、reverse()で逆順に並び替える
  const entries = Object.entries(CONFIG.ROLES).reverse();

  for (const [key, value] of entries) {
    // 【利用禁止】は新規申請の選択肢から除外する
    if (value === CONFIG.ROLES.BANNED) continue;

    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    roleSelect.appendChild(option);
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
  fieldAppType.classList.add("hidden");
  fieldTargetHousehold.classList.add("hidden");
  fieldKeyword.classList.add("hidden");

  // 権限ごとの表示制御
  if (role === CONFIG.ROLES.SYSTEM_ADMIN) {
    // ① システム管理者: 登録用キーワードを表示
    fieldKeyword.classList.remove("hidden");
  }
  else if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN) {
    // ③ 世帯管理者: 申請種別を表示し、その内容で分岐
    fieldAppType.classList.remove("hidden");
    if (appType === "メンバー追加") {
      fieldTargetHousehold.classList.remove("hidden");
    }
  } 
  else if (role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
    // ④ 予定回答者・閲覧者: 対象世帯IDのみ
    fieldTargetHousehold.classList.remove("hidden");
  }
}

/**
 * ステータス取得処理
 */
async function fetchUserStatus(lineUserId) {
  const url = `${CONFIG.GAS_WEB_APP_URL}?action=checkStatus&lineUserId=${encodeURIComponent(lineUserId)}`;

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.status === "success") {
      document.getElementById("status-display").innerText = 
        `現在の権限ステータス: ${result.role} / ${result.approvalStatus}`;

      // 「未登録」の場合は申請フォームを表示する
      if (result.role === "未登録") {
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
