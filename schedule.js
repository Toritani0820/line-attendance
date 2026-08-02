<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>スケジュール確認・回答</title>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-800 p-4">

  <div class="max-w-md mx-auto">
    <!-- ヘッダー / マイページ情報 -->
    <div class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 class="text-xl font-bold mb-2">スケジュール管理</h2>
      <p id="user-status-info" class="font-medium text-sm text-gray-600">ユーザー情報を読み込み中...</p>
    </div>

    <!-- メッセージ表示用 -->
    <div id="app-message-box" class="hidden mb-4 p-3 rounded text-sm"></div>

    <!-- スケジュール機能領域 -->
    <div class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 class="text-lg font-bold mb-4">スケジュール一覧</h3>
      <div id="schedule-content">
        <p class="text-sm text-gray-500">スケジュールデータを読み込んでいます...</p>
      </div>
    </div>
  </div>

  <script src="config.js"></script>
  <script src="schedule.js"></script>
</body>
</html>
