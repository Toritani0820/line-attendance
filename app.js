let currentLineUserId = "";

window.onload = async function() {
  try {
    // config.jsで定義した設定値を使用
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

  const payload = {
    action: "applyRole",
    lineUserId: currentLineUserId,
    applicantName: document.getElementById("applicantName").value,
    role: document.getElementById("role").value,
    applicationType: document.getElementById("applicationType").value,
    targetHouseholdId: document.getElementById("targetHouseholdId").value,
    remark: document.getElementById("remark").value
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
