document.addEventListener("DOMContentLoaded", () => {
  initRoleSelect();
});

/**
 * config.jsの定義から希望権限のセレクトボックスを逆順で生成する
 * （【利用禁止】は除外）
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
 * 選択された権限や申請種別に応じて入力欄の表示/非表示を切り替える
 */
function handleRoleOrTypeChange() {
  const role = document.getElementById("role").value;
  const appTypeSelect = document.getElementById("applicationType");
  const appType = appTypeSelect ? appTypeSelect.value : "";

  const fieldAppType = document.getElementById("field-applicationType");
  const fieldTargetHousehold = document.getElementById("field-targetHouseholdId");
  const fieldKeyword = document.getElementById("field-keyword");

  // いったんすべて非表示にする
  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldTargetHousehold) fieldTargetHousehold.classList.add("hidden");
  if (fieldKeyword) fieldKeyword.classList.add("hidden");

  // 【システム管理者のみ】キーワード入力欄を表示
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
 * 申請フォーム送信処理（GASのウェブアプリへ送信）
 */
async function submitApplication(event) {
  event.preventDefault();

  const applicantName = document.getElementById("applicantName").value;
  const role = document.getElementById("role").value;
  const appType = document.getElementById("applicationType") ? document.getElementById("applicationType").value : "";
  const targetHouseholdId = document.getElementById("targetHouseholdId") ? document.getElementById("targetHouseholdId").value : "";
  const adminKeyword = document.getElementById("adminKeyword") ? document.getElementById("adminKeyword").value : "";

  // LIFFなどから取得したLINEユーザーID
  const lineUserId = window.currentLineUserId || "TEST_LINE_USER_ID";

  const payload = {
    lineUserId: lineUserId,
    applicantName: applicantName,
    role: role,
    applicationType: appType,
    targetHouseholdId: targetHouseholdId,
    keyword: adminKeyword
  };

  // ※デプロイしたGASの「ウェブアプリのURL」に書き換えてください
  const GAS_API_URL = "https://script.google.com/macros/s/【あなたのGASのウェブアプリURL】/exec";

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // GAS側から返却されたステータスに応じて処理
    if (result.status === "success") {
      alert(result.message || "申請を受け付けました。");
      location.reload();
    } else {
      // キーワード違いのエラーメッセージやロック中の警告を表示
      alert(result.message);
    }

  } catch (error) {
    console.error("通信エラー:", error);
    alert("サーバーとの通信に失敗しました。時間をおいて再度お試しください。");
  }
}
