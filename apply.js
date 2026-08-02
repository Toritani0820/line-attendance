let currentLineUserId = "";
let currentLineDisplayName = "";
let isSystemAdminExists = true;

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

      isSystemAdminExists = result.systemAdminExists !== undefined ? result.systemAdminExists : true;

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
        let statusHtml = `現在のステータス: <span class="text-gray-600 font-bold">未登録</span>`;
        if (!isSystemAdminExists) {
          statusHtml += `<br><span class="text-red-600 font-bold text-xs mt-1 block">※システム管理者が未設定です。初期のシステム管理者登録を行います（登録用キーが必要です）。</span>`;
        }
        statusDisplay.innerHTML = statusHtml;
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

// ロール選択肢の設定
// ・未設定時：システム管理者のみ選択可能
// ・設定済時：権限の低い方から順に設定し、初期値を「閲覧者」にする
function loadRoleOptions() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect) return;

  roleSelect.innerHTML = '';

  if (!isSystemAdminExists) {
    const opt = document.createElement("option");
    opt.value = CONFIG.ROLES.SYSTEM_ADMIN;
    opt.textContent = CONFIG.ROLES.SYSTEM_ADMIN;
    opt.selected = true;
    roleSelect.appendChild(opt);
  } else {
    const roles = [
      { value: CONFIG.ROLES.VIEWER, label: CONFIG.ROLES.VIEWER },
      { value: CONFIG.ROLES.RESPONDENT, label: CONFIG.ROLES.RESPONDENT },
      { value: CONFIG.ROLES.HOUSEHOLD_ADMIN, label: CONFIG.ROLES.HOUSEHOLD_ADMIN },
      { value: CONFIG.ROLES.OPERATION_ADMIN, label: CONFIG.ROLES.OPERATION_ADMIN },
      { value: CONFIG.ROLES.SYSTEM_ADMIN, label: CONFIG.ROLES.SYSTEM_ADMIN }
    ];

    roles.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.value;
      opt.textContent = r.label;
      if (r.value === CONFIG.ROLES.VIEWER) {
        opt.selected = true;
      }
      roleSelect.appendChild(opt);
    });
  }

  updateFieldVisibility();
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

// ロール別・申請区分別の入力項目表示制御（HTMLに要素がない場合は動的生成する安全策を内包）
function updateFieldVisibility() {
  const roleInput = document.getElementById("role");
  if (!roleInput) return;
  const role = roleInput.value;

  const fieldAppType = document.getElementById("field-applicationType");
  const fieldHouseholdName = document.getElementById("field-householdName");
  const fieldHouseholdId = document.getElementById("field-targetHouseholdId");
  
  // キーワード入力欄がHTMLに存在しない場合に備えて動的生成する処理
  let fieldAdminKeyword = document.getElementById("field-adminKeyword");
  if (!fieldAdminKeyword) {
    const roleGroup = roleInput.closest('.mb-4') || roleInput.parentElement;
    if (roleGroup) {
      fieldAdminKeyword = document.createElement("div");
      fieldAdminKeyword.id = "field-adminKeyword";
      fieldAdminKeyword.className = "mb-4 hidden";
      fieldAdminKeyword.innerHTML = `
        <label class="block text-sm font-medium text-gray-700 mb-1" for="adminKeyword">登録用キー (管理者キーワード) <span class="text-red-500">*</span></label>
        <input type="password" id="adminKeyword" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="キーを入力してください">
      `;
      roleGroup.after(fieldAdminKeyword);
    }
  }

  // すべて一度非表示にする
  if (fieldAppType) fieldAppType.classList.add("hidden");
  if (fieldHouseholdName) fieldHouseholdName.classList.add("hidden");
  if (fieldHouseholdId) fieldHouseholdId.classList.add("hidden");
  if (fieldAdminKeyword) fieldAdminKeyword.classList.add("hidden");

  // 表示制御
  if (!isSystemAdminExists && role === CONFIG.ROLES.SYSTEM_ADMIN) {
    if (fieldAdminKeyword) fieldAdminKeyword.classList.remove("hidden");
  } else if (role === CONFIG.ROLES.SYSTEM_ADMIN || role === CONFIG.ROLES.OPERATION_ADMIN) {
    if (fieldAdminKeyword) fieldAdminKeyword.classList.remove("hidden");
  } else if (role === CONFIG.ROLES.HOUSEHOLD_ADMIN) {
    if (fieldAppType) fieldAppType.classList.remove("hidden");

    const appTypeSelect = document.getElementById("applicationType");
    const appType = appTypeSelect ? appTypeSelect.value : "";

    if (appType === "新規登録") {
      if (fieldHouseholdName) fieldHouseholdName.classList.remove("hidden");
    } else if (appType === "管理者追加") {
      if (fieldHouseholdId) fieldHouseholdId.classList.remove("hidden");
    }
  } else if (role === CONFIG.ROLES.RESPONDENT || role === CONFIG.ROLES.VIEWER) {
    if (fieldHouseholdId) fieldHouseholdId.classList.remove("hidden");
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
    action: "applyRole",
    lineUserId: currentLineUserId,
    lineDisplayName: currentLineDisplayName,
    fullName: fullName,
    role: role,
    applicationType: document.getElementById("applicationType") ? document.getElementById("applicationType").value : "",
    householdName: document.getElementById("householdName") ? document.getElementById("householdName").value.trim() : "",
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
