let currentLineUserId = "";
let currentLineDisplayName = "";

window.onload = async function() {
  await initializeApplyApp();
  setupFormDynamicFields();
};

async function initializeApplyApp() {
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

    // LINE表示名を設定
    const nameInput = document.getElementById("lineDisplayName");
    if (nameInput) nameInput.value = currentLineDisplayName;

    // サーバーに現在のステータスを問い合わせ
    await checkUserStatus(currentLineUserId);

  } catch (err) {
    console.error("初期化エラー:", err);
    showAppMessage("初期化に失敗しました: " + err.message, "error");
  }
}

async function checkUserStatus(lineUserId) {
  try {
    const url = `${CONFIG.GAS_WEB_APP_URL}?action=checkStatus&lineUserId=${encodeURIComponent(lineUserId)}`;
    const response = await fetch(url);
    const result = await response.json();

    const statusDisplay = document.getElementById("status-display");
    const regCard = document.getElementById("registration-card");

    if (result.status === "success") {
      const approval = result.approvalStatus || "未登録";
      const role = result.role || "未設定";
      const memberName = result.memberName || "";

      if (approval === "承認済") {
        statusDisplay.innerHTML = `
          現在のステータス: <span class="text-green-600 font-bold">承認済 (${role})</span><br>
          氏名: ${memberName}<br>
          <span class="text-xs text-gray-500 mt-1 block">すでに承認されています。スケジュール画面へ移動できます。</span>
        `;
        // 承認済みの場合はスケジュール画面への案内リンクを表示するなど
        regCard.classList.add("hidden");
        
        // 自動でスケジュール画面に飛ばす場合:
        // window.location.replace("schedule.html");

      } else if (approval === "申請中") {
        statusDisplay.innerHTML = `
          現在のステータス: <span class="text-yellow-600 font-bold">承認待ち（申請中）</span><br>
          申請された氏名: ${memberName}<br>
          <span class="text-xs text-gray-500 mt-1 block">管理者の承認をお待ちください。</span>
        `;
        regCard.classList.add("hidden");
      } else {
        statusDisplay.innerHTML = `現在のステータス: <span class="text-gray-600 font-bold">未登録</span>`;
        regCard.classList.remove("hidden");
        loadRoleOptions();
      }
    } else {
      statusDisplay.innerText = "ステータスの取得に失敗しました。";
    }
  } catch (err) {
    console.error("ステータス確認エラー:", err);
    showAppMessage("サーバーとの通信に失敗しました。", "error");
  }
}

// 権限のセレクトボックス初期化
function loadRoleOptions() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect) return;

  // 必要に応じて選択肢を定義
  const roles = [
    { value: "一般メンバー", label: "一般メンバー" },
    { value: "世帯代表", label: "世帯代表" },
    { value: "システム管理者", label: "システム管理者" }
  ];

  roleSelect.innerHTML = '<option value="">選択してください</option>';
  roles.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.value;
    opt.textContent = r.label;
    roleSelect.appendChild(opt);
  });
}

// フォームの入力項目動的切り替え
function setupFormDynamicFields() {
  const roleSelect = document.getElementById("role");
  const appTypeSelect = document.getElementById("applicationType");

  if (roleSelect) {
    roleSelect.addEventListener("change", function() {
      updateFieldVisibility();
    });
  }

  if (appTypeSelect) {
    appTypeSelect.addEventListener("change", function() {
      updateFieldVisibility();
    });
  }
}

function updateFieldVisibility() {
  const role = document.getElementById("role").value;
  const appType = document.getElementById("applicationType") ? document.getElementById("applicationType").value : "新規登録";

  const fieldAppType = document.getElementById("field-applicationType");
  const fieldHouseholdId = document.getElementById("field-targetHouseholdId");
  const fieldHouseholdName = document.getElementById("field-householdName");
  const fieldNote = document.getElementById("field-note");
  const fieldKeyword = document.getElementById("field-keyword");

  // すべて一旦非課税・非表示にリセット
  fieldAppType.classList.add("hidden");
  fieldHouseholdId.classList.add("hidden");
  fieldHouseholdName.classList.add("hidden");
  fieldNote.classList.add("hidden");
  fieldKeyword.classList.add("hidden");

  if (role === "一般メンバー") {
    fieldAppType.classList.remove("hidden");
    fieldNote.classList.remove("hidden");
    if (appType === "新規登録") {
      fieldHouseholdId.classList.remove("hidden");
    } else {
      fieldHouseholdId.classList.remove("hidden");
    }
  } else if (role === "世帯代表") {
    fieldHouseholdName.classList.remove("hidden");
    fieldNote.classList.remove("hidden");
  } else if (role === "システム管理者") {
    fieldKeyword.classList.remove("hidden");
    fieldNote.classList.remove("hidden");
  }
}

// 申請送信処理
async function submitApplication() {
  const submitBtn = document.getElementById("submit-btn");
  const fullName = document.getElementById("fullName").value.trim();
  const role = document.getElementById("role").value;

  if (!fullName || !role) {
    showAppMessage("氏名と希望権限は必須です。", "error");
    return;
  }

  const formData = {
    action: "submitApplication",
    lineUserId: currentLineUserId,
    lineDisplayName: currentLineDisplayName,
    fullName: fullName,
    role: role,
    applicationType: document.getElementById("applicationType") ? document.getElementById("applicationType").value : "",
    targetHouseholdId: document.getElementById("targetHouseholdId") ? document.getElementById("targetHouseholdId").value.trim() : "",
    householdName: document.getElementById("householdName") ? document.getElementById("householdName").value.trim() : "",
    note: document.getElementById("note") ? document.getElementById("note").value.trim() : "",
    adminKeyword: document.getElementById("adminKeyword") ? document.getElementById("adminKeyword").value.trim() : ""
  };

  try {
    submitBtn.disabled = true;
    submitBtn.innerText = "送信中...";

    const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(formData),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });

    const result = await response.json();

    if (result.status === "success") {
      showAppMessage("利用申請を送信しました。管理者の承認をお待ちください。", "success");
      document.getElementById("registration-card").classList.add("hidden");
      setTimeout(() => {
        location.reload();
      }, 2000);
    } else {
      showAppMessage("申請エラー: " + result.message, "error");
      submitBtn.disabled = false;
      submitBtn.innerText = "申請する";
    }
  } catch (err) {
    console.error("送信通信エラー:", err);
    showAppMessage("通信エラーが発生しました。", "error");
    submitBtn.disabled = false;
    submitBtn.innerText = "申請する";
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
