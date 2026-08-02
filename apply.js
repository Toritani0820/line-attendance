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

    const nameInput = document.getElementById("lineDisplayName");
    if (nameInput) nameInput.value = currentLineDisplayName;

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
          <span class="text-xs text-gray-500 mt-1 block">すでに承認されています。スケジュール画面へ移動します。</span>
        `;
        regCard.classList.add("hidden");
        window.location.replace("schedule.html");
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

// config.js の CONFIG.ROLES を使って正しい権限選択肢を構築
function loadRoleOptions() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect) return;

  const roles = [
    { value: CONFIG.ROLES.SYSTEM_ADMIN, label: CONFIG.ROLES.SYSTEM_ADMIN },
    { value: CONFIG.ROLES.OPERATION_ADMIN, label: CONFIG.ROLES.OPERATION_ADMIN },
    { value: CONFIG.ROLES.HOUSEHOLD_ADMIN, label: CONFIG.ROLES.HOUSEHOLD_ADMIN },
    { value: CONFIG.ROLES.RESPONDENT, label: CONFIG.ROLES.RESPONDENT },
    { value: CONFIG.ROLES.VIEWER, label: CONFIG.ROLES.VIEWER }
  ];

  roleSelect.innerHTML = '<option value="">選択してください</option>';
  roles.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.value;
    opt.textContent = r.label;
    roleSelect.appendChild(opt);
  });
}

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
  const fieldAppType = document.getElementById("field-applicationType");
  const fieldHouseholdId = document.getElementById("field-targetHouseholdId");
  const fieldAdminKeyword = document.getElementById("field-adminKeyword");

  if (!fieldAppType) return;

  // 初期化としてすべて非表示
  fieldAppType.classList.add("hidden");
  fieldHouseholdId.classList.add("hidden");
  if (fieldAdminKeyword) fieldAdminKeyword.classList.add("hidden");

  if (role === CONFIG.ROLES.SYSTEM_ADMIN) {
    if (fieldAdminKeyword) fieldAdminKeyword.classList.remove("hidden");
  } else if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN || role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
    fieldAppType.classList.remove("hidden");
    fieldHouseholdId.classList.remove("hidden");
  }
}

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
    adminKeyword: document.getElementById("adminKeyword") ? document.getElementById("adminKeyword").value.trim() : "",
    note: document.getElementById("note") ? document.getElementById("note").value.trim() : ""
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
