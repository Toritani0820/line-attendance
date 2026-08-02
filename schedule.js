let currentLineUserId = "";
let currentLineDisplayName = "";

window.onload = function() {
  initializeScheduleApp();
};

async function initializeScheduleApp() {
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

    // サーバーからユーザーの登録情報・ステータスを取得し、ガード処理を実行
    await fetchAndDisplayUserInfo(currentLineUserId);

  } catch (err) {
    console.error("スケジュール画面初期化エラー:", err);
    showAppMessage("初期化に失敗しました: " + err.message, "error");
  }
}

async function fetchAndDisplayUserInfo(lineUserId) {
  try {
    const url = `${CONFIG.GAS_WEB_APP_URL}?action=checkStatus&lineUserId=${encodeURIComponent(lineUserId)}`;
    const response = await fetch(url);
    const result = await response.json();

    const statusInfo = document.getElementById("user-status-info");
    
    if (result.status === "success") {
      const approvalStatus = result.approvalStatus || "未登録";
      
      // 【重要】承認済ではない場合（未登録・申請中など）は、強制的に apply.html へリダイレクト
      if (approvalStatus !== "承認済") {
        window.location.replace("apply.html");
        return;
      }

      if (statusInfo) {
        statusInfo.innerHTML = `
          氏名: <span class="font-bold text-gray-800">${result.memberName || result.fullName || "未設定"}</span><br>
          権限: <span class="font-bold text-gray-800">${result.role}</span>（${approvalStatus}）
        `;
      }
    } else {
      // 取得失敗や未登録扱いの場合は申請画面へ
      window.location.replace("apply.html");
    }
  } catch (err) {
    console.error("情報取得通信エラー:", err);
    showAppMessage("ユーザー情報の取得に失敗しました。", "error");
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
