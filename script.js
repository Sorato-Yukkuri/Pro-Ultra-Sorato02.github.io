let capturedDataUrl = null;
const scores = { cpu:0, gpu:0, mem:0, fps:0 };
const diag   = {};

const wait   = ms => new Promise(r => setTimeout(r, ms));
const setRow = (id, text, cls) => {
    document.getElementById('v-'+id).textContent = text;
    document.getElementById('row-'+id).className = 'spec-row st-'+cls;
};
const st = (ok, warn) => ok ? 'ok' : (warn ? 'warn' : 'bad');

// ══════════════════════════════════════════════════════════════
// ⚙️ 設定システム
// ══════════════════════════════════════════════════════════════
const SETTINGS_KEY = 'app_settings_v1';

const DEFAULT_SETTINGS = {
    theme:          'dark',      // 'dark' | 'light' | 'system'
    language:       'ja',        // 'ja' | 'ja-hira' | 'en' | 'zh-hans' | 'zh-hant' | 'ko'
    soundOnDone:    true,        // 診断終了音
    soundPreset:    'default',   // 'default'|'bell'|'beep'|'fanfare'|'custom'
    soundFileDataUrl: null,      // カスタム音声のDataURL
    fontSize:       'normal',    // 'small' | 'normal' | 'large'
    exportFormat:   'png',       // 'png' | 'csv' | 'pdf'
    speedUnit:      'mbps',      // 'mbps' | 'mbs'
    desktopNotify:  true,        // 完了時デスクトップ通知
    vibration:      true,        // バイブレーション
    badge:          true,        // アイコンバッジ
    quietStart:     '22:00',     // お休み時間 開始
    quietEnd:       '06:40',     // お休み時間 終了
    autoCheck:      false,       // 開いたとき自動チェック
    clumsiGuard:    true,        // うっかりガード
    translateGuard: true,        // Google翻訳崩れ防止
    customFontSize: 15,          // カスタムフォントサイズ(px)
    fontFamily:     'system',    // フォントファミリー
};

let _settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        _settings = { ...DEFAULT_SETTINGS, ...s };
    } catch(e) {
        _settings = { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
    } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// 🌐 言語翻訳システム（動的切り替え・全11言語）
// ══════════════════════════════════════════════════════════════

// 診断項目ラベル（row-1〜row-34対応）
const I18N_LABELS = {
    'ja': ['CPU 論理コア数','システムメモリ容量','GPU レンダラー','GPU 最大テクスチャサイズ','実測 CPU ベンチスコア','実測 GPU 描画スコア','実測メモリ帯域スコア','実測平均フレームレート','実測 1% LOW フレームレート','画面リフレッシュレート(推定)','画面解像度 (物理ピクセル)','デバイスピクセル比 (DPR)','カラー深度 / HDR 対応','JS ヒープ上限','UIスレッド応答レイテンシ','ネットワーク速度 (実測)','回線種別 / API 実効帯域','バッテリー残量 / 充電状態','タッチポイント数','ダークモード / ハイコントラスト','セキュア通信 (HTTPS)','Cookie / IndexedDB','WebGL バージョン','WebGL 最大頂点属性数','WakeLock / 振動 API','PWA / Service Worker','自動操縦検知 (WebDriver)','FPS ジッタースコア','システム言語 / タイムゾーン','診断エンジンバージョン','IP アドレス (WebRTC)','ダークモード / ハイコントラスト','使用ブラウザ','デバイス機種'],
    'ja-hira': ['CPUのこあすう','めもりようりょう','GPUのしゅるい','GPUさいだいてくすちゃ','CPUせいのうすこあ','GPUせいのうすこあ','めもりたいいきすこあ','へいきんFPS','1%LOWのFPS','がめんこうしんひんど(すいてい)','がめんかいぞうど','でばいすぴくせるひ','からーふかど/HDR','JSひーぷじょうげん','UIおうとうそくど','つうしんそくど(じっそく)','かいせんしゅるい','でんちざんりょう','たっちぽいんとすう','だーくもーど','あんごうつうしん','Cookieとほぞん','WebGLばーじょん','WebGLちょうてんぞくせい','WakeLock/しんどう','PWA/サービスワーカー','じどうそうじゅうけんち','FPSあんていせい','げんごとたいむぞーん','しんだんえんじんばーじょん','IPあどれす','だーくもーど','つかっているぶらうざ','でばいすのきしゅ'],
    'en': ['CPU Logical Cores','System Memory','GPU Renderer','GPU Max Texture Size','CPU Bench Score','GPU Render Score','Memory Bandwidth Score','Avg Frame Rate','1% LOW Frame Rate','Screen Refresh Rate (est.)','Screen Resolution (Physical)','Device Pixel Ratio (DPR)','Color Depth / HDR','JS Heap Limit','UI Thread Latency','Network Speed (measured)','Connection Type / API Bandwidth','Battery / Charging Status','Touch Points','Dark Mode / High Contrast','Secure Connection (HTTPS)','Cookie / IndexedDB','WebGL Version','WebGL Max Vertex Attribs','WakeLock / Vibration API','PWA / Service Worker','Bot Detection (WebDriver)','FPS Jitter Score','System Language / Timezone','Diagnostic Engine Version','IP Address (WebRTC)','Dark Mode / High Contrast','Browser','Device Model'],
    'zh-hans': ['CPU逻辑核心数','系统内存容量','GPU渲染器','GPU最大纹理尺寸','CPU基准分数','GPU渲染分数','内存带宽分数','平均帧率','1%低帧率','屏幕刷新率(估计)','屏幕分辨率(物理像素)','设备像素比(DPR)','色彩深度/HDR支持','JS堆内存上限','UI线程响应延迟','网络速度(实测)','网络类型/API带宽','电池余量/充电状态','触控点数量','深色模式/高对比度','安全连接(HTTPS)','Cookie/IndexedDB','WebGL版本','WebGL最大顶点属性数','WakeLock/振动API','PWA/Service Worker','自动化检测(WebDriver)','FPS抖动分数','系统语言/时区','诊断引擎版本','IP地址(WebRTC)','深色模式/高对比度','使用的浏览器','设备型号'],
    'zh-hant': ['CPU邏輯核心數','系統記憶體容量','GPU渲染器','GPU最大紋理尺寸','CPU基準分數','GPU渲染分數','記憶體頻寬分數','平均幀率','1%低幀率','螢幕更新率(估計)','螢幕解析度(實體像素)','裝置像素比(DPR)','色彩深度/HDR支援','JS堆記憶體上限','UI執行緒回應延遲','網路速度(實測)','網路類型/API頻寬','電池餘量/充電狀態','觸控點數量','深色模式/高對比度','安全連線(HTTPS)','Cookie/IndexedDB','WebGL版本','WebGL最大頂點屬性數','WakeLock/震動API','PWA/Service Worker','自動化偵測(WebDriver)','FPS抖動分數','系統語言/時區','診斷引擎版本','IP位址(WebRTC)','深色模式/高對比度','使用的瀏覽器','裝置型號'],
    'ko': ['CPU 논리 코어 수','시스템 메모리 용량','GPU 렌더러','GPU 최대 텍스처 크기','CPU 벤치 점수','GPU 렌더 점수','메모리 대역폭 점수','평균 프레임률','1% LOW 프레임률','화면 재생률(추정)','화면 해상도(물리 픽셀)','기기 픽셀 비율(DPR)','색심도/HDR 지원','JS 힙 한도','UI 스레드 응답 지연','네트워크 속도(실측)','연결 유형/API 대역폭','배터리/충전 상태','터치 포인트 수','다크 모드/고대비','보안 연결(HTTPS)','Cookie/IndexedDB','WebGL 버전','WebGL 최대 정점 속성 수','WakeLock/진동 API','PWA/Service Worker','봇 감지(WebDriver)','FPS 지터 점수','시스템 언어/시간대','진단 엔진 버전','IP 주소(WebRTC)','다크 모드/고대비','사용 중인 브라우저','기기 모델'],
    'vi': ['Số nhân CPU','Dung lượng RAM','GPU Renderer','Kích thước texture tối đa','Điểm CPU','Điểm GPU','Điểm băng thông bộ nhớ','FPS trung bình','1% LOW FPS','Tần số quét màn hình(ước tính)','Độ phân giải màn hình(pixel vật lý)','Tỷ lệ pixel thiết bị(DPR)','Độ sâu màu/HDR','Giới hạn JS Heap','Độ trễ UI thread','Tốc độ mạng(đo thực tế)','Loại kết nối/Băng thông API','Pin/Trạng thái sạc','Số điểm chạm','Chế độ tối/Tương phản cao','Kết nối bảo mật(HTTPS)','Cookie/IndexedDB','Phiên bản WebGL','Thuộc tính đỉnh WebGL tối đa','WakeLock/Rung API','PWA/Service Worker','Phát hiện bot(WebDriver)','Điểm ổn định FPS','Ngôn ngữ/Múi giờ','Phiên bản engine chẩn đoán','Địa chỉ IP(WebRTC)','Chế độ tối/Tương phản cao','Trình duyệt','Model thiết bị'],
    'es': ['Núcleos lógicos CPU','Memoria del sistema','Renderizador GPU','Tamaño máximo de textura GPU','Puntuación CPU','Puntuación GPU','Puntuación de ancho de banda','FPS promedio','1% LOW FPS','Tasa de refresco(estimada)','Resolución de pantalla(píxeles físicos)','Relación de píxeles(DPR)','Profundidad de color/HDR','Límite JS Heap','Latencia UI Thread','Velocidad de red(medida)','Tipo de conexión/Ancho de banda','Batería/Estado de carga','Puntos táctiles','Modo oscuro/Alto contraste','Conexión segura(HTTPS)','Cookie/IndexedDB','Versión WebGL','Atributos de vértice WebGL','WakeLock/API de vibración','PWA/Service Worker','Detección de bots(WebDriver)','Puntuación de jitter FPS','Idioma del sistema/Zona horaria','Versión del motor de diagnóstico','Dirección IP(WebRTC)','Modo oscuro/Alto contraste','Navegador','Modelo de dispositivo'],
    'pt': ['Núcleos lógicos CPU','Memória do sistema','Renderizador GPU','Tamanho máximo de textura GPU','Pontuação CPU','Pontuação GPU','Pontuação de largura de banda','FPS médio','1% LOW FPS','Taxa de atualização(estimada)','Resolução da tela(pixels físicos)','Taxa de pixels do dispositivo(DPR)','Profundidade de cor/HDR','Limite JS Heap','Latência UI Thread','Velocidade de rede(medida)','Tipo de conexão/Largura de banda','Bateria/Status de carga','Pontos de toque','Modo escuro/Alto contraste','Conexão segura(HTTPS)','Cookie/IndexedDB','Versão WebGL','Atributos de vértice WebGL','WakeLock/API de vibração','PWA/Service Worker','Detecção de bots(WebDriver)','Pontuação de jitter FPS','Idioma do sistema/Fuso horário','Versão do motor de diagnóstico','Endereço IP(WebRTC)','Modo escuro/Alto contraste','Navegador','Modelo do dispositivo'],
    'fr': ['Cœurs logiques CPU','Mémoire système','Rendu GPU','Taille max texture GPU','Score CPU','Score GPU','Score bande passante','FPS moyen','1% LOW FPS','Taux de rafraîchissement(estimé)','Résolution écran(pixels physiques)','Ratio pixels(DPR)','Profondeur couleur/HDR','Limite JS Heap','Latence UI Thread','Vitesse réseau(mesurée)','Type connexion/Bande passante API','Batterie/Statut charge','Points tactiles','Mode sombre/Contraste élevé','Connexion sécurisée(HTTPS)','Cookie/IndexedDB','Version WebGL','Attributs vertex WebGL','WakeLock/API vibration','PWA/Service Worker','Détection bot(WebDriver)','Score jitter FPS','Langue système/Fuseau horaire','Version moteur diagnostic','Adresse IP(WebRTC)','Mode sombre/Contraste élevé','Navigateur','Modèle appareil'],
    'de': ['CPU-Logikkerne','Systemspeicher','GPU-Renderer','Maximale GPU-Texturgröße','CPU-Benchmark','GPU-Benchmark','Speicherbandbreite','Durchschnittliche FPS','1% LOW FPS','Bildwiederholrate(geschätzt)','Bildschirmauflösung(physisch)','Gerätepixelverhältnis(DPR)','Farbtiefe/HDR','JS-Heap-Limit','UI-Thread-Latenz','Netzwerkgeschwindigkeit(gemessen)','Verbindungstyp/API-Bandbreite','Akku/Ladestatus','Berührungspunkte','Dunkelmodus/Hoher Kontrast','Sichere Verbindung(HTTPS)','Cookie/IndexedDB','WebGL-Version','Max WebGL-Vertex-Attribute','WakeLock/Vibrations-API','PWA/Service Worker','Bot-Erkennung(WebDriver)','FPS-Jitter-Score','Systemsprache/Zeitzone','Diagnose-Engine-Version','IP-Adresse(WebRTC)','Dunkelmodus/Hoher Kontrast','Browser','Gerätemodell'],
    'ru': ['Логических ядер CPU','Объём системной памяти','Рендерер GPU','Макс. размер текстуры GPU','Оценка CPU','Оценка GPU','Оценка пропускной способности','Средний FPS','1% LOW FPS','Частота обновления экрана(оценка)','Разрешение экрана(физические пиксели)','Соотношение пикселей(DPR)','Глубина цвета/HDR','Лимит JS Heap','Задержка UI потока','Скорость сети(измеренная)','Тип соединения/Пропускная способность','Батарея/Статус зарядки','Точки касания','Тёмная тема/Высокий контраст','Защищённое соединение(HTTPS)','Cookie/IndexedDB','Версия WebGL','Макс. атрибуты вершин WebGL','WakeLock/API вибрации','PWA/Service Worker','Обнаружение бота(WebDriver)','Оценка дрожания FPS','Язык системы/Часовой пояс','Версия движка диагностики','IP-адрес(WebRTC)','Тёмная тема/Высокий контраст','Браузер','Модель устройства'],
};

// row番号→ラベルインデックスのマッピング（1〜34をそのまま使う、0始まりの配列なのでrow-1=index0）
const LABEL_ROW_IDS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34];

const I18N = {
    'ja': {
        statusTitle:   'ハードウェア精密スキャン中...',
        evalMsg:       '各コンポーネントの整合性を検証しています',
        saveBtnTxt:    '診断レポートを画像で保存する',
        saveBtnCSV:    '📊 CSVで保存する',
        saveBtnPDF:    '📄 PDFで保存する',
        aiBtnTxt:      '🤖 AIアドバイザーに相談する',
        historyBtnTxt: '📊 過去の診断結果を見る',
        speedBtnTxt:   '⚡ ページ読み込み速度テスト',
        retryBtnTxt:   '🔄 再診断する',
        rankMsgs: { S:'最高峰のフラッグシップ性能です', A:'非常に快適で強力な環境です', B:'一般的な標準デバイス性能です', C:'動作の遅延が目立ち、やや非力です', D:'性能が不足している旧型環境です' },
        bench: ['CPU 演算性能を計測中...','素数計算・行列積・ビット演算を実行しています','GPU 描画性能を計測中...','WebGL シェーダー・Canvas 2D 合成描画を負荷試験中','メモリ帯域を計測中...','シーケンシャル・ストライド・ランダムアクセスを測定中','システムメモリを精密解析中...','5手法を統合中','ネットワーク速度を実測中...','実際にデータを取得して実効帯域を計算しています','バッテリー・UIレイテンシを計測中...','Battery API・UIスレッド応答遅延を同時取得しています','省電力モードを確認中...','タイマー精度を計測しています','フレームレート安定性を計測中...','rAF遅延ギャップ方式で15秒間精密計測中'],
        val: { supported:'対応', unsupported:'非対応', running:'起動中', browser:'ブラウザ', secure:'安全 (HTTPS / TLS)', insecure:'非暗号 (HTTP)', detected:'⚠ 自動操縦を検知', normal:'正常 (手動操作)', hidden:'非表示', measuring:'計測不可', failed:'計測失敗 (オフライン?)', fast:'高速', medium:'普通', slow:'低速', charging:'⚡充電中', discharging:'🔋放電中', enabled:'有効', disabled:'無効', dark:'ダーク:ON', light:'ダーク:OFF', hiconOn:'ハイコン:ON', hiconOff:'ハイコン:OFF', estimated:'推定', highPrec:'高精度', midPrec:'精度中' },
        ui: { legendBtn:'🎨 色の基準を確認する', shareHint:'💡 プレビュー画面のダウンロードボタン下からXにシェアできます', speedDesc:'主要サイトへの接続時間を計測します。', speedNote:'※ブラウザ制限により参考値です。', fpsAvgDesc:'（1秒間に何回画面が更新されるか。高いほど滑らか）', fpsLowDesc:'(最も重い場面でのFPS。低いとカクつきを感じやすい)', uaDesc:'（OS・ブラウザなど環境情報をまとめた文字列）', remaining:'推定残り時間: 約 ', seconds:' 秒', fpsMeasuring:' 秒 (FPS計測中)', fpsCalc:'FPS集計中...', finalizing:'最終処理中...',
            scoreLabel:'総合スコア', memLabel:'MEM帯域', fpsLabel:'FPS安定', netLabel:'NET',
            settingsTitle:'⚙️ 設定', settingsReset:'🔄 設定をリセット', settingsResetConfirm:'設定をすべてデフォルトに戻しますか？',
            secAppearance:'🎨 外観', secLanguage:'🌐 言語', secNotify:'🔔 通知・フィードバック', secQuiet:'😴 お休み時間', secData:'💾 データ・操作',
            labelTheme:'テーマ', optDark:'ダーク', optLight:'ライト', optSystem:'システム',
            labelFontSize:'フォントサイズ', optSmall:'小', optNormal:'普通', optLarge:'大', optCustom:'カスタム', labelCustomSize:'カスタムサイズ', labelFont:'フォント', fontSystem:'システム標準', fontGothic:'ゴシック体', fontSerif:'明朝体・セリフ', fontRounded:'丸ゴシック', fontMono:'等幅フォント', labelFont:'フォント', fontSystem:'システム標準', fontGothic:'ゴシック体', fontSerif:'明朝体・セリフ', fontRounded:'丸ゴシック', fontMono:'等幅',
            labelLanguage:'表示言語',
            labelTransGuard:'Google翻訳崩れ防止', labelSound:'診断終了音', labelSoundPreset:'サウンドプリセット', soundDefault:'デフォルト（チャイム）', soundBell:'ベル', soundBeep:'ビープ', soundFanfare:'ファンファーレ', soundCustom:'カスタム（ファイル）', labelSoundFile:'カスタム音声ファイル', soundFileHint:'MP3・WAV・FLACに対応', soundUploadBtn:'📁 ファイルを選択', soundFileLoaded:'読み込み済み', soundFileClear:'削除', labelVibration:'バイブレーション',
            labelDesktopNotify:'完了時デスクトップ通知', labelBadge:'アイコンバッジ表示',
            labelQuietStart:'開始時刻', labelQuietEnd:'終了時刻',
            labelExportFmt:'書き出し形式', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'通信速度の単位', labelAutoCheck:'開いたとき自動診断', labelGuard:'うっかりガード',
            ipWarnTitle:'⚠️ IPアドレスをスクリーンショットに含めますか？',
            ipWarnBody:'IPアドレスをSNSなどで公開すると、おおよその居住地域や利用プロバイダが特定される危険があります。公開する予定がある場合は「IPアドレスを非表示にして保存」をおすすめします。',
            ipHide:'🔒 IPアドレスを非表示にして保存（推奨）', ipMask:'⚠️ 一部を * で隠して保存', ipShow:'そのまま含めて保存',
            ipNote:'※ IPアドレスの取得は外部APIへの問い合わせのみで行われます。取得した値はブラウザ内でのみ使用され、当診断ツールのサーバーには一切送信されません。',
            ipBack:'← 戻る（保存をキャンセル）',
            devWarnTitle:'📱 デバイス機種名をそのまま含めますか？',
            devShow:'そのまま含めて保存', devHide:'🔒 デバイス名を * に変更して保存',
            devNote:'※ デバイス名はUA文字列から取得しており、サーバーには送信されません。',
            devBack:'← 戻る（IPアドレスの選択に戻る）',
            loginRequired:'ProUltraにログイン', loginMsg:'はログインが必要です。Googleアカウントで無料登録できます。',
            loginBtn:'ログイン', cancelBtn:'キャンセル', logoutBtn:'ログアウト',
            syncOk:'✓ 同期済み', syncing:'同期中...', syncFail:'⚠ 同期失敗', synced:'✓ 同期中',
            friendCodeTitle:'親友コードでログイン', friendCodePlaceholder:'コードを入力...', friendCodeError:'コードが違います', friendLoginBtn:'ログイン',
            diagComplete:'✅ 処理が完了しました', imgGenComplete:'✅ 画像の生成が完了しました',
            retryConfirm:'再診断しますか？\n現在の診断結果は上書きされます。',
            notifyPromptReason:'診断完了時にデスクトップ通知でお知らせします。\n次の画面でブラウザの通知許可を求めます。許可しますか？',
            fpsAvgLabel:'実測平均フレームレート', fpsLowLabel:'1% LOW フレームレート', uaLabel:'ユーザーエージェント詳細スタック',
        },
    },
    'ja-hira': {
        statusTitle:   'せいのうをはかっています...',
        evalMsg:       'かくこうもくをかくにんしています',
        saveBtnTxt:    'しんだんけっかをがぞうでほぞんする',
        saveBtnCSV:    '📊 CSVでほぞんする',
        saveBtnPDF:    '📄 PDFでほぞんする',
        aiBtnTxt:      '🤖 AIにそうだんする',
        historyBtnTxt: '📊 むかしのしんだんをみる',
        speedBtnTxt:   '⚡ つうしんそくどをはかる',
        retryBtnTxt:   '🔄 もういちどはかる',
        rankMsgs: { S:'さいこうのせいのうです', A:'とてもよいせいのうです', B:'ふつうのせいのうです', C:'すこしおそいです', D:'ふるいきしゅです' },
        bench: ['CPUをはかっています...','けいさんをしています','GPUをはかっています...','えをかいてせいのうをみています','めもりをはかっています...','よみかきのはやさをみています','めもりのようりょうをかくにんしています...','いろいろなほうほうでしらべています','つうしんそくどをはかっています...','じっさいにつないではかっています','でんちとおうとうそくどをはかっています...','でんちとおそさをみています','せつでんもーどをかくにんしています...','たいまーのせいかくさをみています','FPSをはかっています...','15びょうかんせいかくにはかっています'],
        val: { supported:'たいおう', unsupported:'ひたいおう', running:'きどうちゅう', browser:'ぶらうざ', secure:'あんぜん(HTTPS)', insecure:'あんごうなし', detected:'⚠ じどうそうじゅうけんち', normal:'せいじょう', hidden:'ひひょうじ', measuring:'はかれません', failed:'けいそくしっぱい', fast:'はやい', medium:'ふつう', slow:'おそい', charging:'⚡じゅうでんちゅう', discharging:'🔋ほうでんちゅう', enabled:'ゆうこう', disabled:'むこう', dark:'だーく:ON', light:'だーく:OFF', hiconOn:'ひこんとらすと:ON', hiconOff:'ひこんとらすと:OFF', estimated:'すいてい', highPrec:'こうせいど', midPrec:'せいどちゅう' },
        ui: { legendBtn:'🎨 いろのきじゅんをかくにんする', shareHint:'💡 ぷれびゅーがめんからXにしぇあできます', speedDesc:'いろんなさいとへのつながるじかんをはかります。', speedNote:'※ぶらうざのせいげんであくまでもさんこうです。', fpsAvgDesc:'（1びょうにがめんがなんかいこうしんされるか）', fpsLowDesc:'(いちばんおもいばめんでのFPS)', uaDesc:'（ぶらうざやOSのじょうほうのもじれつ）', remaining:'のこりやく ', seconds:' びょう', fpsMeasuring:' びょう(FPS)', fpsCalc:'FPSしゅうけいちゅう...', finalizing:'さいしゅうしょりちゅう...',
            scoreLabel:'そうごうすこあ', memLabel:'めもりたいいき', fpsLabel:'FPSあんてい', netLabel:'NET',
            settingsTitle:'⚙️ せってい', settingsReset:'🔄 せっていをりせっと', settingsResetConfirm:'せっていをぜんぶもとにもどしますか？',
            secAppearance:'🎨 みため', secLanguage:'🌐 げんご', secNotify:'🔔 つうちとふぃーどばっく', secQuiet:'😴 おやすみじかん', secData:'💾 でーたとそうさ',
            labelTheme:'てーま', optDark:'だーく', optLight:'らいと', optSystem:'しすてむ',
            labelFontSize:'もじのおおきさ', optSmall:'ちいさい', optNormal:'ふつう', optLarge:'おおきい', optCustom:'かすたむ', labelCustomSize:'かすたむさいず',
            labelLanguage:'ひょうじげんご',
            labelTransGuard:'ぐーぐるほんやくほご', labelSound:'しんだんおわりおと', labelVibration:'ばいぶれーしょん',
            labelDesktopNotify:'つうちきのう', labelBadge:'あいこんばっじ',
            labelQuietStart:'かいしじこく', labelQuietEnd:'しゅうりょうじこく',
            labelExportFmt:'ほぞんけいしき', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'つうしんそくどのたんい', labelAutoCheck:'じどうしんだん', labelGuard:'うっかりがーど',
            ipWarnTitle:'⚠️ IPあどれすをふくめますか？', ipWarnBody:'IPあどれすをこうかいすると、すんでいるばしょがわかるかもしれません。',
            ipHide:'🔒 IPあどれすをかくす（すいしょう）', ipMask:'⚠️ いちぶを*でかくす', ipShow:'そのままふくめる',
            ipNote:'※ IPあどれすはぶらうざないだけでつかいます。', ipBack:'← もどる',
            devWarnTitle:'📱 きしゅめいをふくめますか？', devShow:'そのままふくめる', devHide:'🔒 きしゅめいをかくす',
            devNote:'※ きしゅめいはさーばーにそうしんしません。', devBack:'← もどる',
            loginRequired:'ProUltraにろぐいん', loginMsg:'はろぐいんがひつようです。', loginBtn:'Googleでろぐいん', cancelBtn:'きゃんせる', logoutBtn:'ろぐあうと',
            syncOk:'✓ どうきずみ', syncing:'どうきちゅう...', syncFail:'⚠ どうきしっぱい', synced:'✓ どうきちゅう',
            friendCodeTitle:'しんゆうこーどでろぐいん', friendCodePlaceholder:'こーどをにゅうりょく...', friendCodeError:'こーどがちがいます', friendLoginBtn:'ろぐいん',
            diagComplete:'✅ しょりがかんりょうしました', imgGenComplete:'✅ がぞうがかんりょうしました',
            retryConfirm:'もういちどしんだんしますか？',
            fpsAvgLabel:'へいきんFPS', fpsLowLabel:'1%さいていFPS', uaLabel:'ぶらうざじょうほう',
        },
    },
    'en': {
        statusTitle:   'Scanning hardware...',
        evalMsg:       'Verifying component integrity',
        saveBtnTxt:    'Save Report as Image',
        saveBtnCSV:    '📊 Save as CSV',
        saveBtnPDF:    '📄 Save as PDF',
        aiBtnTxt:      '🤖 Ask AI Advisor',
        historyBtnTxt: '📊 View Past Results',
        speedBtnTxt:   '⚡ Page Load Speed Test',
        retryBtnTxt:   '🔄 Re-diagnose',
        rankMsgs: { S:'Flagship-class performance', A:'High-performance device', B:'Standard performance', C:'Below average performance', D:'Low-end / Legacy device' },
        bench: ['Measuring CPU performance...','Running prime/matrix/SHA benchmarks','Measuring GPU rendering...','WebGL shaders & Canvas 2D stress test','Measuring memory bandwidth...','Sequential, stride & random access test','Analyzing system memory...','Integrating 5 estimation methods','Measuring network speed...','Fetching data to calculate bandwidth','Measuring battery & UI latency...','Battery API & UI thread latency','Checking power saving mode...','Measuring timer accuracy','Measuring frame rate stability...','rAF jitter method — 15 second precision test'],
        val: { supported:'Supported', unsupported:'Not supported', running:'Running', browser:'Browser', secure:'Secure (HTTPS / TLS)', insecure:'Insecure (HTTP)', detected:'⚠ Automation detected', normal:'Normal (manual)', hidden:'Hidden', measuring:'Cannot measure', failed:'Measurement failed (offline?)', fast:'Fast', medium:'Average', slow:'Slow', charging:'⚡ Charging', discharging:'🔋 Discharging', enabled:'Enabled', disabled:'Disabled', dark:'Dark: ON', light:'Dark: OFF', hiconOn:'HiContrast: ON', hiconOff:'HiContrast: OFF', estimated:'Estimated', highPrec:'High accuracy', midPrec:'Mid accuracy' },
        ui: { legendBtn:'🎨 View color indicators', shareHint:'💡 You can share to X from the download button in the preview', speedDesc:'Measures connection time to major sites.', speedNote:'※ Reference only due to browser limitations.', fpsAvgDesc:'(Screen updates per second. Higher = smoother)', fpsLowDesc:'(FPS in heaviest scenes. Lower = more stutter)', uaDesc:'(Browser/OS environment info string)', remaining:'Est. remaining: ~', seconds:' sec', fpsMeasuring:' sec (FPS measuring)', fpsCalc:'Calculating FPS...', finalizing:'Finalizing...',
            scoreLabel:'Total Score', memLabel:'Mem BW', fpsLabel:'FPS Stab', netLabel:'NET',
            settingsTitle:'⚙️ Settings', settingsReset:'🔄 Reset Settings', settingsResetConfirm:'Reset all settings to default?',
            secAppearance:'🎨 Appearance', secLanguage:'🌐 Language', secNotify:'🔔 Notifications & Feedback', secQuiet:'😴 Quiet Hours', secData:'💾 Data & Operations',
            labelTheme:'Theme', optDark:'Dark', optLight:'Light', optSystem:'System',
            labelFontSize:'Font Size', optSmall:'Small', optNormal:'Normal', optLarge:'Large', optCustom:'Custom', labelCustomSize:'Custom Size', labelFont:'Font', fontSystem:'System Default', fontGothic:'Gothic / Sans-serif', fontSerif:'Serif / Mincho', fontRounded:'Rounded', fontMono:'Monospace', labelFont:'Font', fontSystem:'System Default', fontGothic:'Gothic (Sans)', fontSerif:'Serif / Mincho', fontRounded:'Rounded', fontMono:'Monospace',
            labelLanguage:'Display Language',
            labelTransGuard:'Google Translate Guard', labelSound:'Completion Sound', labelSoundPreset:'Sound Preset', soundDefault:'Default (Chime)', soundBell:'Bell', soundBeep:'Beep', soundFanfare:'Fanfare', soundCustom:'Custom (File)', labelSoundFile:'Custom Sound File', soundFileHint:'MP3, WAV, FLAC supported', soundUploadBtn:'📁 Choose File', soundFileLoaded:'File loaded', soundFileClear:'Remove', labelVibration:'Vibration',
            labelDesktopNotify:'Desktop Notification', labelBadge:'App Icon Badge',
            labelQuietStart:'Start Time', labelQuietEnd:'End Time',
            labelExportFmt:'Export Format', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'Speed Unit', labelAutoCheck:'Auto Diagnose on Open', labelGuard:'Accidental Tap Guard',
            ipWarnTitle:'⚠️ Include IP address in screenshot?',
            ipWarnBody:'Sharing your IP address publicly can reveal your approximate location and ISP. We recommend hiding it.',
            ipHide:'🔒 Hide IP address (recommended)', ipMask:'⚠️ Partially mask with *', ipShow:'Include as-is',
            ipNote:'※ IP is obtained via external API only, used within browser, never sent to our servers.',
            ipBack:'← Back (cancel save)',
            devWarnTitle:'📱 Include device model in screenshot?', devShow:'Include as-is', devHide:'🔒 Replace with *',
            devNote:'※ Device name is from UA string and is not sent to servers.', devBack:'← Back (return to IP selection)',
            loginRequired:'Login Required', loginMsg:' requires login. Register free with Google.', loginBtn:'Sign in with Google', cancelBtn:'Cancel', logoutBtn:'Logout',
            syncOk:'✓ Synced', syncing:'Syncing...', syncFail:'⚠ Sync failed', synced:'✓ Syncing',
            friendCodeTitle:'Login with Friend Code', friendCodePlaceholder:'Enter code...', friendCodeError:'Invalid code', friendLoginBtn:'Login',
            diagComplete:'✅ Diagnosis complete', imgGenComplete:'✅ Image generated',
            retryConfirm:'Re-diagnose?\nCurrent results will be overwritten.',
            notifyPromptReason:'Allow desktop notifications when diagnosis completes?\nYou will be asked for browser notification permission.',
            fpsAvgLabel:'Avg Frame Rate', fpsLowLabel:'1% LOW Frame Rate', uaLabel:'User Agent Stack',
        },
    },
    'zh-hans': {
        statusTitle:   '正在扫描硬件...',
        evalMsg:       '正在验证各组件的完整性',
        saveBtnTxt:    '将报告保存为图片',
        saveBtnCSV:    '📊 保存为CSV',
        saveBtnPDF:    '📄 保存为PDF',
        aiBtnTxt:      '🤖 咨询AI顾问',
        historyBtnTxt: '📊 查看历史结果',
        speedBtnTxt:   '⚡ 页面加载速度测试',
        retryBtnTxt:   '🔄 重新诊断',
        rankMsgs: { S:'旗舰级性能', A:'高性能设备', B:'标准性能设备', C:'性能略显不足', D:'低端/老旧设备' },
        bench: ['正在测量CPU性能...','运行素数/矩阵/SHA基准测试','正在测量GPU渲染...','WebGL着色器和Canvas 2D压力测试','正在测量内存带宽...','顺序、跨步和随机访问测试','正在精密分析系统内存...','整合5种估算方法','正在实测网络速度...','获取数据计算带宽','正在测量电池和UI延迟...','Battery API和UI线程延迟','正在检查节电模式...','测量计时器精度','正在测量帧率稳定性...','rAF抖动方式精密计测15秒'],
        val: { supported:'支持', unsupported:'不支持', running:'运行中', browser:'浏览器', secure:'安全 (HTTPS/TLS)', insecure:'不加密 (HTTP)', detected:'⚠ 检测到自动化', normal:'正常 (手动)', hidden:'已隐藏', measuring:'无法测量', failed:'测量失败 (离线?)', fast:'快速', medium:'普通', slow:'缓慢', charging:'⚡充电中', discharging:'🔋放电中', enabled:'启用', disabled:'禁用', dark:'深色:ON', light:'深色:OFF', hiconOn:'高对比:ON', hiconOff:'高对比:OFF', estimated:'估算', highPrec:'高精度', midPrec:'中精度' },
        ui: { legendBtn:'🎨 查看颜色指示说明', shareHint:'💡 可在预览界面下载按钮处分享到X', speedDesc:'测量到各主要网站的连接时间。', speedNote:'※ 受浏览器限制，仅供参考。', fpsAvgDesc:'（每秒刷新次数，越高越流畅）', fpsLowDesc:'(最卡场景的FPS，越低越明显)', uaDesc:'（浏览器/OS环境信息字符串）', remaining:'预计剩余: 约', seconds:'秒', fpsMeasuring:'秒(FPS测量中)', fpsCalc:'FPS计算中...', finalizing:'最终处理中...',
            scoreLabel:'总分', memLabel:'内存带宽', fpsLabel:'FPS稳定', netLabel:'NET',
            settingsTitle:'⚙️ 设置', settingsReset:'🔄 重置设置', settingsResetConfirm:'将所有设置重置为默认值？',
            secAppearance:'🎨 外观', secLanguage:'🌐 语言', secNotify:'🔔 通知和反馈', secQuiet:'😴 勿扰时间', secData:'💾 数据和操作',
            labelTheme:'主题', optDark:'深色', optLight:'浅色', optSystem:'跟随系统',
            labelFontSize:'字体大小', optSmall:'小', optNormal:'中', optLarge:'大', optCustom:'自定义', labelCustomSize:'自定义大小',
            labelLanguage:'显示语言', labelTransGuard:'防谷歌翻译乱版', labelSound:'完成提示音', labelVibration:'振动',
            labelDesktopNotify:'桌面通知', labelBadge:'应用图标角标',
            labelQuietStart:'开始时间', labelQuietEnd:'结束时间',
            labelExportFmt:'导出格式', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'速度单位', labelAutoCheck:'打开时自动诊断', labelGuard:'误触保护',
            ipWarnTitle:'⚠️ 截图是否包含IP地址？', ipWarnBody:'公开IP地址可能暴露您的大致位置和运营商，建议隐藏。',
            ipHide:'🔒 隐藏IP地址（推荐）', ipMask:'⚠️ 部分*遮蔽', ipShow:'直接包含',
            ipNote:'※ IP地址仅在浏览器内使用，不会发送到本工具服务器。', ipBack:'← 返回（取消保存）',
            devWarnTitle:'📱 截图是否包含设备型号？', devShow:'直接包含', devHide:'🔒 替换为*',
            devNote:'※ 设备名称从UA字符串获取，不会发送到服务器。', devBack:'← 返回',
            loginRequired:'需要登录', loginMsg:'需要登录。可使用Google账号免费注册。', loginBtn:'使用Google登录', cancelBtn:'取消', logoutBtn:'退出登录',
            syncOk:'✓ 已同步', syncing:'同步中...', syncFail:'⚠ 同步失败', synced:'✓ 同步中',
            friendCodeTitle:'使用亲友码登录', friendCodePlaceholder:'请输入代码...', friendCodeError:'代码错误', friendLoginBtn:'登录',
            diagComplete:'✅ 诊断完成', imgGenComplete:'✅ 图片已生成',
            retryConfirm:'重新诊断？\n当前结果将被覆盖。',
            fpsAvgLabel:'平均帧率', fpsLowLabel:'1%低帧率', uaLabel:'用户代理字符串',
        },
    },
    'zh-hant': {
        statusTitle:   '正在掃描硬體...',
        evalMsg:       '正在驗證各元件的完整性',
        saveBtnTxt:    '將報告儲存為圖片',
        saveBtnCSV:    '📊 儲存為CSV',
        saveBtnPDF:    '📄 儲存為PDF',
        aiBtnTxt:      '🤖 諮詢AI顧問',
        historyBtnTxt: '📊 查看歷史結果',
        speedBtnTxt:   '⚡ 頁面載入速度測試',
        retryBtnTxt:   '🔄 重新診斷',
        rankMsgs: { S:'旗艦級效能', A:'高效能裝置', B:'標準效能裝置', C:'效能略顯不足', D:'低階/舊型裝置' },
        bench: ['正在測量CPU效能...','執行質數/矩陣/SHA基準測試','正在測量GPU渲染...','WebGL著色器和Canvas 2D壓力測試','正在測量記憶體頻寬...','順序、跨步和隨機存取測試','正在精密分析系統記憶體...','整合5種估算方法','正在實測網路速度...','取得資料計算頻寬','正在測量電池和UI延遲...','Battery API和UI執行緒延遲','正在檢查省電模式...','測量計時器精度','正在測量幀率穩定性...','rAF抖動方式精密計測15秒'],
        val: { supported:'支援', unsupported:'不支援', running:'執行中', browser:'瀏覽器', secure:'安全 (HTTPS/TLS)', insecure:'不加密 (HTTP)', detected:'⚠ 偵測到自動化', normal:'正常 (手動)', hidden:'已隱藏', measuring:'無法測量', failed:'測量失敗 (離線?)', fast:'快速', medium:'普通', slow:'緩慢', charging:'⚡充電中', discharging:'🔋放電中', enabled:'啟用', disabled:'停用', dark:'深色:ON', light:'深色:OFF', hiconOn:'高對比:ON', hiconOff:'高對比:OFF', estimated:'估算', highPrec:'高精度', midPrec:'中精度' },
        ui: { legendBtn:'🎨 查看顏色指示說明', shareHint:'💡 可在預覽介面下載按鈕處分享到X', speedDesc:'測量到各主要網站的連線時間。', speedNote:'※ 受瀏覽器限制，僅供參考。', fpsAvgDesc:'（每秒重新整理次數，越高越流暢）', fpsLowDesc:'(最卡場景的FPS，越低越明顯)', uaDesc:'（瀏覽器/OS環境資訊字串）', remaining:'預計剩餘: 約', seconds:'秒', fpsMeasuring:'秒(FPS測量中)', fpsCalc:'FPS計算中...', finalizing:'最終處理中...',
            scoreLabel:'總分', memLabel:'記憶體頻寬', fpsLabel:'FPS穩定', netLabel:'NET',
            settingsTitle:'⚙️ 設定', settingsReset:'🔄 重置設定', settingsResetConfirm:'將所有設定重置為預設值？',
            secAppearance:'🎨 外觀', secLanguage:'🌐 語言', secNotify:'🔔 通知和回饋', secQuiet:'😴 勿擾時間', secData:'💾 資料和操作',
            labelTheme:'主題', optDark:'深色', optLight:'淺色', optSystem:'跟隨系統',
            labelFontSize:'字體大小', optSmall:'小', optNormal:'中', optLarge:'大', optCustom:'自訂', labelCustomSize:'自訂大小',
            labelLanguage:'顯示語言', labelTransGuard:'防Google翻譯版面錯亂', labelSound:'完成提示音', labelVibration:'震動',
            labelDesktopNotify:'桌面通知', labelBadge:'應用圖示角標',
            labelQuietStart:'開始時間', labelQuietEnd:'結束時間',
            labelExportFmt:'匯出格式', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'速度單位', labelAutoCheck:'開啟時自動診斷', labelGuard:'誤觸保護',
            ipWarnTitle:'⚠️ 截圖是否包含IP位址？', ipWarnBody:'公開IP位址可能暴露您的大致位置和ISP，建議隱藏。',
            ipHide:'🔒 隱藏IP位址（推薦）', ipMask:'⚠️ 部分*遮蔽', ipShow:'直接包含',
            ipNote:'※ IP位址僅在瀏覽器內使用，不會傳送至本工具伺服器。', ipBack:'← 返回（取消儲存）',
            devWarnTitle:'📱 截圖是否包含裝置型號？', devShow:'直接包含', devHide:'🔒 替換為*',
            devNote:'※ 裝置名稱從UA字串取得，不會傳送至伺服器。', devBack:'← 返回',
            loginRequired:'需要登入', loginMsg:'需要登入。可使用Google帳號免費註冊。', loginBtn:'使用Google登入', cancelBtn:'取消', logoutBtn:'登出',
            syncOk:'✓ 已同步', syncing:'同步中...', syncFail:'⚠ 同步失敗', synced:'✓ 同步中',
            friendCodeTitle:'使用親友碼登入', friendCodePlaceholder:'請輸入代碼...', friendCodeError:'代碼錯誤', friendLoginBtn:'登入',
            diagComplete:'✅ 診斷完成', imgGenComplete:'✅ 圖片已生成',
            retryConfirm:'重新診斷？\n目前結果將被覆蓋。',
            fpsAvgLabel:'平均幀率', fpsLowLabel:'1%低幀率', uaLabel:'使用者代理字串',
        },
    },
    'ko': {
        statusTitle:   '하드웨어 스캔 중...',
        evalMsg:       '각 구성 요소를 확인하고 있습니다',
        saveBtnTxt:    '진단 보고서를 이미지로 저장',
        saveBtnCSV:    '📊 CSV로 저장',
        saveBtnPDF:    '📄 PDF로 저장',
        aiBtnTxt:      '🤖 AI 어드바이저에게 상담',
        historyBtnTxt: '📊 과거 진단 결과 보기',
        speedBtnTxt:   '⚡ 페이지 로딩 속도 테스트',
        retryBtnTxt:   '🔄 재진단',
        rankMsgs: { S:'최고급 플래그십 성능', A:'매우 쾌적한 고성능 기기', B:'일반적인 표준 기기', C:'다소 느린 기기', D:'구형 저사양 기기' },
        bench: ['CPU 성능 측정 중...','소수/행렬/SHA 벤치마크 실행','GPU 렌더링 측정 중...','WebGL 쉐이더 및 Canvas 2D 스트레스 테스트','메모리 대역폭 측정 중...','순차, 스트라이드 및 랜덤 액세스 테스트','시스템 메모리 정밀 분석 중...','5가지 추정 방법 통합','네트워크 속도 실측 중...','데이터 가져와서 대역폭 계산','배터리 및 UI 지연 측정 중...','Battery API 및 UI 스레드 지연','절전 모드 확인 중...','타이머 정확도 측정','프레임률 안정성 측정 중...','rAF 지터 방식 15초 정밀 측정'],
        val: { supported:'지원', unsupported:'미지원', running:'실행 중', browser:'브라우저', secure:'보안 (HTTPS/TLS)', insecure:'비암호화 (HTTP)', detected:'⚠ 자동화 감지', normal:'정상 (수동)', hidden:'숨김', measuring:'측정 불가', failed:'측정 실패 (오프라인?)', fast:'빠름', medium:'보통', slow:'느림', charging:'⚡ 충전 중', discharging:'🔋 방전 중', enabled:'활성화', disabled:'비활성화', dark:'다크:ON', light:'다크:OFF', hiconOn:'고대비:ON', hiconOff:'고대비:OFF', estimated:'추정', highPrec:'고정밀', midPrec:'중정밀' },
        ui: { legendBtn:'🎨 색상 기준 확인', shareHint:'💡 미리보기 화면에서 X로 공유할 수 있습니다', speedDesc:'주요 사이트로의 연결 시간을 측정합니다.', speedNote:'※ 브라우저 제한으로 참고값입니다.', fpsAvgDesc:'(초당 화면 갱신 횟수. 높을수록 부드러움)', fpsLowDesc:'(가장 무거운 장면의 FPS. 낮을수록 끊김)', uaDesc:'(브라우저/OS 환경 정보 문자열)', remaining:'예상 남은 시간: 약 ', seconds:' 초', fpsMeasuring:' 초 (FPS 측정 중)', fpsCalc:'FPS 집계 중...', finalizing:'최종 처리 중...',
            scoreLabel:'총점', memLabel:'메모리 대역폭', fpsLabel:'FPS 안정', netLabel:'NET',
            settingsTitle:'⚙️ 설정', settingsReset:'🔄 설정 초기화', settingsResetConfirm:'모든 설정을 기본값으로 초기화하시겠습니까?',
            secAppearance:'🎨 외관', secLanguage:'🌐 언어', secNotify:'🔔 알림 및 피드백', secQuiet:'😴 방해 금지 시간', secData:'💾 데이터 및 작업',
            labelTheme:'테마', optDark:'다크', optLight:'라이트', optSystem:'시스템',
            labelFontSize:'글자 크기', optSmall:'작게', optNormal:'보통', optLarge:'크게', optCustom:'사용자 정의', labelCustomSize:'사용자 정의 크기',
            labelLanguage:'표시 언어', labelTransGuard:'Google 번역 레이아웃 보호', labelSound:'완료 사운드', labelVibration:'진동',
            labelDesktopNotify:'데스크톱 알림', labelBadge:'앱 아이콘 배지',
            labelQuietStart:'시작 시간', labelQuietEnd:'종료 시간',
            labelExportFmt:'내보내기 형식', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'속도 단위', labelAutoCheck:'열면 자동 진단', labelGuard:'실수 방지',
            ipWarnTitle:'⚠️ 스크린샷에 IP 주소를 포함하시겠습니까?', ipWarnBody:'IP 주소를 공개하면 위치와 ISP가 노출될 수 있습니다.',
            ipHide:'🔒 IP 주소 숨기기 (권장)', ipMask:'⚠️ 일부를 *로 가리기', ipShow:'그대로 포함',
            ipNote:'※ IP 주소는 브라우저 내에서만 사용되며 서버로 전송되지 않습니다.', ipBack:'← 뒤로 (저장 취소)',
            devWarnTitle:'📱 스크린샷에 기기 모델을 포함하시겠습니까?', devShow:'그대로 포함', devHide:'🔒 *로 대체',
            devNote:'※ 기기 이름은 UA 문자열에서 가져오며 서버로 전송되지 않습니다.', devBack:'← 뒤로',
            loginRequired:'로그인 필요', loginMsg:'에는 로그인이 필요합니다.', loginBtn:'Google로 로그인', cancelBtn:'취소', logoutBtn:'로그아웃',
            syncOk:'✓ 동기화됨', syncing:'동기화 중...', syncFail:'⚠ 동기화 실패', synced:'✓ 동기화 중',
            friendCodeTitle:'친구 코드로 로그인', friendCodePlaceholder:'코드 입력...', friendCodeError:'코드가 틀립니다', friendLoginBtn:'로그인',
            diagComplete:'✅ 진단 완료', imgGenComplete:'✅ 이미지 생성 완료',
            retryConfirm:'재진단하시겠습니까?\n현재 결과가 덮어쓰여집니다.',
            fpsAvgLabel:'평균 프레임률', fpsLowLabel:'1% LOW 프레임률', uaLabel:'유저 에이전트',
        },
    },
    'vi': {
        statusTitle:   'Đang quét phần cứng...',
        evalMsg:       'Đang xác minh tính toàn vẹn của các thành phần',
        saveBtnTxt:    'Lưu báo cáo dưới dạng hình ảnh',
        saveBtnCSV:    '📊 Lưu dạng CSV',
        saveBtnPDF:    '📄 Lưu dạng PDF',
        aiBtnTxt:      '🤖 Tư vấn AI',
        historyBtnTxt: '📊 Xem kết quả chẩn đoán cũ',
        speedBtnTxt:   '⚡ Kiểm tra tốc độ tải trang',
        retryBtnTxt:   '🔄 Chẩn đoán lại',
        rankMsgs: { S:'Hiệu suất đỉnh cao', A:'Thiết bị hiệu suất cao', B:'Thiết bị tiêu chuẩn', C:'Hiệu suất dưới mức trung bình', D:'Thiết bị cũ / thấp cấp' },
        bench: ['Đang đo CPU...','Chạy benchmark','Đang đo GPU...','Kiểm tra tải WebGL và Canvas','Đang đo băng thông bộ nhớ...','Kiểm tra đọc/ghi tuần tự và ngẫu nhiên','Đang phân tích RAM...','Tổng hợp 5 phương pháp','Đang đo tốc độ mạng...','Tải dữ liệu để tính băng thông','Đang đo pin và độ trễ UI...','Battery API và độ trễ UI thread','Đang kiểm tra chế độ tiết kiệm điện...','Đo độ chính xác bộ đếm thời gian','Đang đo ổn định frame rate...','Phương pháp rAF jitter 15 giây'],
        val: { supported:'Hỗ trợ', unsupported:'Không hỗ trợ', running:'Đang chạy', browser:'Trình duyệt', secure:'Bảo mật (HTTPS)', insecure:'Không mã hóa (HTTP)', detected:'⚠ Phát hiện tự động hóa', normal:'Bình thường', hidden:'Đã ẩn', measuring:'Không đo được', failed:'Đo thất bại (offline?)', fast:'Nhanh', medium:'Trung bình', slow:'Chậm', charging:'⚡ Đang sạc', discharging:'🔋 Đang xả', enabled:'Bật', disabled:'Tắt', dark:'Tối:ON', light:'Tối:OFF', hiconOn:'Tương phản:ON', hiconOff:'Tương phản:OFF', estimated:'Ước tính', highPrec:'Độ chính xác cao', midPrec:'Độ chính xác TB' },
        ui: { legendBtn:'🎨 Xem chú thích màu sắc', shareHint:'💡 Bạn có thể chia sẻ lên X từ nút tải trong xem trước', speedDesc:'Đo thời gian kết nối đến các trang web lớn.', speedNote:'※ Chỉ mang tính tham khảo do giới hạn trình duyệt.', fpsAvgDesc:'(Số lần cập nhật màn hình/giây. Cao hơn = mượt hơn)', fpsLowDesc:'(FPS ở cảnh nặng nhất. Thấp = giật nhiều)', uaDesc:'(Chuỗi thông tin môi trường trình duyệt/OS)', remaining:'Ước tính còn: ~', seconds:' giây', fpsMeasuring:' giây (đang đo FPS)', fpsCalc:'Đang tính FPS...', finalizing:'Đang xử lý cuối...',
            scoreLabel:'Tổng điểm', memLabel:'BW bộ nhớ', fpsLabel:'Ổn định FPS', netLabel:'NET',
            settingsTitle:'⚙️ Cài đặt', settingsReset:'🔄 Đặt lại', settingsResetConfirm:'Đặt lại tất cả cài đặt về mặc định?',
            secAppearance:'🎨 Giao diện', secLanguage:'🌐 Ngôn ngữ', secNotify:'🔔 Thông báo', secQuiet:'😴 Giờ yên tĩnh', secData:'💾 Dữ liệu',
            labelTheme:'Chủ đề', optDark:'Tối', optLight:'Sáng', optSystem:'Hệ thống',
            labelFontSize:'Cỡ chữ', optSmall:'Nhỏ', optNormal:'Bình thường', optLarge:'Lớn', optCustom:'Tùy chỉnh', labelCustomSize:'Kích thước tùy chỉnh',
            labelLanguage:'Ngôn ngữ', labelTransGuard:'Bảo vệ Google Dịch', labelSound:'Âm thanh hoàn thành', labelVibration:'Rung',
            labelDesktopNotify:'Thông báo máy tính', labelBadge:'Huy hiệu ứng dụng',
            labelQuietStart:'Giờ bắt đầu', labelQuietEnd:'Giờ kết thúc',
            labelExportFmt:'Định dạng xuất', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'Đơn vị tốc độ', labelAutoCheck:'Tự động chẩn đoán khi mở', labelGuard:'Bảo vệ thao tác nhầm',
            ipWarnTitle:'⚠️ Bao gồm địa chỉ IP trong ảnh chụp màn hình?', ipWarnBody:'Chia sẻ IP có thể lộ vị trí và ISP của bạn.',
            ipHide:'🔒 Ẩn IP (khuyến nghị)', ipMask:'⚠️ Che một phần bằng *', ipShow:'Giữ nguyên',
            ipNote:'※ IP chỉ được dùng trong trình duyệt, không gửi đến máy chủ.', ipBack:'← Quay lại',
            devWarnTitle:'📱 Bao gồm model thiết bị?', devShow:'Giữ nguyên', devHide:'🔒 Thay bằng *',
            devNote:'※ Tên thiết bị lấy từ UA, không gửi đến máy chủ.', devBack:'← Quay lại',
            loginRequired:'Cần đăng nhập', loginMsg:'yêu cầu đăng nhập.', loginBtn:'Đăng nhập Google', cancelBtn:'Hủy', logoutBtn:'Đăng xuất',
            syncOk:'✓ Đã đồng bộ', syncing:'Đang đồng bộ...', syncFail:'⚠ Đồng bộ thất bại', synced:'✓ Đang đồng bộ',
            friendCodeTitle:'Đăng nhập bằng mã bạn bè', friendCodePlaceholder:'Nhập mã...', friendCodeError:'Mã không đúng', friendLoginBtn:'Đăng nhập',
            diagComplete:'✅ Chẩn đoán hoàn tất', imgGenComplete:'✅ Ảnh đã tạo',
            retryConfirm:'Chẩn đoán lại?\nKết quả hiện tại sẽ bị ghi đè.',
            fpsAvgLabel:'FPS trung bình', fpsLowLabel:'1% LOW FPS', uaLabel:'User Agent',
        },
    },
    'es': {
        statusTitle:   'Escaneando hardware...',
        evalMsg:       'Verificando la integridad de los componentes',
        saveBtnTxt:    'Guardar informe como imagen',
        saveBtnCSV:    '📊 Guardar como CSV',
        saveBtnPDF:    '📄 Guardar como PDF',
        aiBtnTxt:      '🤖 Consultar al asesor de IA',
        historyBtnTxt: '📊 Ver resultados anteriores',
        speedBtnTxt:   '⚡ Prueba de velocidad de carga',
        retryBtnTxt:   '🔄 Volver a diagnosticar',
        rankMsgs: { S:'Rendimiento de gama alta', A:'Dispositivo de alto rendimiento', B:'Rendimiento estándar', C:'Rendimiento por debajo del promedio', D:'Dispositivo antiguo / de gama baja' },
        bench: ['Midiendo rendimiento CPU...','Ejecutando benchmarks','Midiendo renderizado GPU...','Prueba de carga WebGL y Canvas','Midiendo ancho de banda de memoria...','Prueba de acceso secuencial y aleatorio','Analizando memoria del sistema...','Integrando 5 métodos de estimación','Midiendo velocidad de red...','Descargando datos para calcular ancho de banda','Midiendo batería y latencia UI...','Battery API y latencia del hilo UI','Verificando modo de ahorro de energía...','Midiendo precisión del temporizador','Midiendo estabilidad de frame rate...','Método de jitter rAF 15 segundos'],
        val: { supported:'Compatible', unsupported:'No compatible', running:'En ejecución', browser:'Navegador', secure:'Seguro (HTTPS/TLS)', insecure:'No cifrado (HTTP)', detected:'⚠ Automatización detectada', normal:'Normal (manual)', hidden:'Oculto', measuring:'No se puede medir', failed:'Medición fallida (offline?)', fast:'Rápido', medium:'Normal', slow:'Lento', charging:'⚡ Cargando', discharging:'🔋 Descargando', enabled:'Habilitado', disabled:'Deshabilitado', dark:'Oscuro:ON', light:'Oscuro:OFF', hiconOn:'AltoContraste:ON', hiconOff:'AltoContraste:OFF', estimated:'Estimado', highPrec:'Alta precisión', midPrec:'Precisión media' },
        ui: { legendBtn:'🎨 Ver indicadores de color', shareHint:'💡 Puedes compartir a X desde el botón de descarga en la vista previa', speedDesc:'Mide el tiempo de conexión a sitios principales.', speedNote:'※ Solo referencia debido a limitaciones del navegador.', fpsAvgDesc:'(Actualizaciones de pantalla por segundo. Mayor = más fluido)', fpsLowDesc:'(FPS en escenas más pesadas. Menor = más tirones)', uaDesc:'(Cadena de información del entorno navegador/SO)', remaining:'Tiempo restante est.: ~', seconds:' seg', fpsMeasuring:' seg (midiendo FPS)', fpsCalc:'Calculando FPS...', finalizing:'Finalizando...',
            scoreLabel:'Puntuación', memLabel:'BW memoria', fpsLabel:'Estab. FPS', netLabel:'NET',
            settingsTitle:'⚙️ Ajustes', settingsReset:'🔄 Restablecer', settingsResetConfirm:'¿Restablecer todos los ajustes?',
            secAppearance:'🎨 Apariencia', secLanguage:'🌐 Idioma', secNotify:'🔔 Notificaciones', secQuiet:'😴 Horas tranquilas', secData:'💾 Datos',
            labelTheme:'Tema', optDark:'Oscuro', optLight:'Claro', optSystem:'Sistema',
            labelFontSize:'Tamaño de fuente', optSmall:'Pequeño', optNormal:'Normal', optLarge:'Grande', optCustom:'Personalizado', labelCustomSize:'Tamaño personalizado',
            labelLanguage:'Idioma', labelTransGuard:'Protección Google Translate', labelSound:'Sonido de fin', labelVibration:'Vibración',
            labelDesktopNotify:'Notificación escritorio', labelBadge:'Insignia de app',
            labelQuietStart:'Hora de inicio', labelQuietEnd:'Hora de fin',
            labelExportFmt:'Formato de exportación', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'Unidad de velocidad', labelAutoCheck:'Auto diagnóstico al abrir', labelGuard:'Protección de toques accidentales',
            ipWarnTitle:'⚠️ ¿Incluir IP en captura?', ipWarnBody:'Compartir tu IP puede revelar ubicación e ISP.',
            ipHide:'🔒 Ocultar IP (recomendado)', ipMask:'⚠️ Enmascarar parcialmente', ipShow:'Incluir tal cual',
            ipNote:'※ IP se usa solo en el navegador.', ipBack:'← Volver (cancelar)',
            devWarnTitle:'📱 ¿Incluir modelo de dispositivo?', devShow:'Incluir tal cual', devHide:'🔒 Reemplazar con *',
            devNote:'※ El nombre del dispositivo proviene del UA.', devBack:'← Volver',
            loginRequired:'Se requiere inicio de sesión', loginMsg:' requiere login.', loginBtn:'Iniciar sesión con Google', cancelBtn:'Cancelar', logoutBtn:'Cerrar sesión',
            syncOk:'✓ Sincronizado', syncing:'Sincronizando...', syncFail:'⚠ Error de sync', synced:'✓ Sincronizando',
            friendCodeTitle:'Iniciar sesión con código', friendCodePlaceholder:'Introduce código...', friendCodeError:'Código incorrecto', friendLoginBtn:'Iniciar sesión',
            diagComplete:'✅ Diagnóstico completo', imgGenComplete:'✅ Imagen generada',
            retryConfirm:'¿Volver a diagnosticar?\nLos resultados actuales se sobrescribirán.',
            fpsAvgLabel:'FPS promedio', fpsLowLabel:'1% LOW FPS', uaLabel:'User Agent',
        },
    },
    'pt': {
        statusTitle:   'Verificando hardware...',
        evalMsg:       'Verificando a integridade dos componentes',
        saveBtnTxt:    'Salvar relatório como imagem',
        saveBtnCSV:    '📊 Salvar como CSV',
        saveBtnPDF:    '📄 Salvar como PDF',
        aiBtnTxt:      '🤖 Consultar o assistente de IA',
        historyBtnTxt: '📊 Ver resultados anteriores',
        speedBtnTxt:   '⚡ Teste de velocidade de carregamento',
        retryBtnTxt:   '🔄 Rediagnosticar',
        rankMsgs: { S:'Desempenho de ponta', A:'Dispositivo de alto desempenho', B:'Desempenho padrão', C:'Desempenho abaixo da média', D:'Dispositivo antigo / de baixo nível' },
        bench: ['Medindo desempenho do CPU...','Executando benchmarks','Medindo renderização da GPU...','Teste de carga WebGL e Canvas','Medindo largura de banda da memória...','Teste de acesso sequencial e aleatório','Analisando memória do sistema...','Integrando 5 métodos de estimativa','Medindo velocidade de rede...','Baixando dados para calcular largura de banda','Medindo bateria e latência UI...','Battery API e latência do thread UI','Verificando modo de economia de energia...','Medindo precisão do temporizador','Medindo estabilidade da taxa de quadros...','Método de jitter rAF 15 segundos'],
        val: { supported:'Compatível', unsupported:'Não compatível', running:'Em execução', browser:'Navegador', secure:'Seguro (HTTPS/TLS)', insecure:'Não criptografado (HTTP)', detected:'⚠ Automação detectada', normal:'Normal (manual)', hidden:'Oculto', measuring:'Não é possível medir', failed:'Medição falhou (offline?)', fast:'Rápido', medium:'Normal', slow:'Lento', charging:'⚡ Carregando', discharging:'🔋 Descarregando', enabled:'Habilitado', disabled:'Desabilitado', dark:'Escuro:ON', light:'Escuro:OFF', hiconOn:'AltoContraste:ON', hiconOff:'AltoContraste:OFF', estimated:'Estimado', highPrec:'Alta precisão', midPrec:'Precisão média' },
        ui: { legendBtn:'🎨 Ver indicadores de cor', shareHint:'💡 Você pode compartilhar no X pelo botão de download na prévia', speedDesc:'Mede o tempo de conexão aos principais sites.', speedNote:'※ Apenas referência devido às limitações do navegador.', fpsAvgDesc:'(Atualizações de tela por segundo. Maior = mais fluido)', fpsLowDesc:'(FPS nas cenas mais pesadas. Menor = mais travamentos)', uaDesc:'(String de informações do ambiente navegador/SO)', remaining:'Tempo restante est.: ~', seconds:' seg', fpsMeasuring:' seg (medindo FPS)', fpsCalc:'Calculando FPS...', finalizing:'Finalizando...',
            scoreLabel:'Pontuação', memLabel:'BW memória', fpsLabel:'Estab. FPS', netLabel:'NET',
            settingsTitle:'⚙️ Configurações', settingsReset:'🔄 Redefinir', settingsResetConfirm:'Redefinir todas as configurações?',
            secAppearance:'🎨 Aparência', secLanguage:'🌐 Idioma', secNotify:'🔔 Notificações', secQuiet:'😴 Horas de silêncio', secData:'💾 Dados',
            labelTheme:'Tema', optDark:'Escuro', optLight:'Claro', optSystem:'Sistema',
            labelFontSize:'Tamanho da fonte', optSmall:'Pequeno', optNormal:'Normal', optLarge:'Grande', optCustom:'Personalizado', labelCustomSize:'Tamanho personalizado',
            labelLanguage:'Idioma', labelTransGuard:'Proteção Google Tradutor', labelSound:'Som de conclusão', labelVibration:'Vibração',
            labelDesktopNotify:'Notificação área de trabalho', labelBadge:'Emblema de app',
            labelQuietStart:'Hora de início', labelQuietEnd:'Hora de fim',
            labelExportFmt:'Formato de exportação', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'Unidade de velocidade', labelAutoCheck:'Diagnóstico auto ao abrir', labelGuard:'Proteção de toque acidental',
            ipWarnTitle:'⚠️ Incluir IP na captura?', ipWarnBody:'Compartilhar IP pode revelar localização e ISP.',
            ipHide:'🔒 Ocultar IP (recomendado)', ipMask:'⚠️ Mascarar parcialmente', ipShow:'Incluir como está',
            ipNote:'※ IP é usado apenas no navegador.', ipBack:'← Voltar (cancelar)',
            devWarnTitle:'📱 Incluir modelo do dispositivo?', devShow:'Incluir como está', devHide:'🔒 Substituir por *',
            devNote:'※ Nome do dispositivo vem do UA.', devBack:'← Voltar',
            loginRequired:'Login necessário', loginMsg:' requer login.', loginBtn:'Entrar com Google', cancelBtn:'Cancelar', logoutBtn:'Sair',
            syncOk:'✓ Sincronizado', syncing:'Sincronizando...', syncFail:'⚠ Falha de sync', synced:'✓ Sincronizando',
            friendCodeTitle:'Entrar com código amigo', friendCodePlaceholder:'Digite o código...', friendCodeError:'Código incorreto', friendLoginBtn:'Entrar',
            diagComplete:'✅ Diagnóstico concluído', imgGenComplete:'✅ Imagem gerada',
            retryConfirm:'Rediagnosticar?\nOs resultados atuais serão sobrescritos.',
            fpsAvgLabel:'FPS médio', fpsLowLabel:'1% LOW FPS', uaLabel:'User Agent',
        },
    },
    'fr': {
        statusTitle:   'Analyse du matériel...',
        evalMsg:       "Vérification de l'intégrité des composants",
        saveBtnTxt:    "Enregistrer le rapport en image",
        saveBtnCSV:    '📊 Enregistrer en CSV',
        saveBtnPDF:    '📄 Enregistrer en PDF',
        aiBtnTxt:      '🤖 Consulter le conseiller IA',
        historyBtnTxt: '📊 Voir les résultats passés',
        speedBtnTxt:   '⚡ Test de vitesse de chargement',
        retryBtnTxt:   '🔄 Re-diagnostiquer',
        rankMsgs: { S:'Performance haut de gamme', A:'Appareil haute performance', B:'Performance standard', C:'Performance en dessous de la moyenne', D:'Appareil ancien / bas de gamme' },
        bench: ['Mesure des performances CPU...','Exécution des benchmarks','Mesure du rendu GPU...','Test de charge WebGL et Canvas','Mesure de la bande passante mémoire...','Test d\'accès séquentiel et aléatoire','Analyse précise de la mémoire système...','Intégration de 5 méthodes d\'estimation','Mesure de la vitesse réseau...','Téléchargement de données pour calculer la bande passante','Mesure de la batterie et latence UI...','Battery API et latence du thread UI','Vérification du mode économie d\'énergie...','Mesure de la précision du minuteur','Mesure de la stabilité du taux de frames...','Méthode jitter rAF 15 secondes'],
        val: { supported:'Supporté', unsupported:'Non supporté', running:'En cours', browser:'Navigateur', secure:'Sécurisé (HTTPS/TLS)', insecure:'Non chiffré (HTTP)', detected:'⚠ Automatisation détectée', normal:'Normal (manuel)', hidden:'Masqué', measuring:'Impossible à mesurer', failed:'Mesure échouée (hors ligne?)', fast:'Rapide', medium:'Moyen', slow:'Lent', charging:'⚡ En charge', discharging:'🔋 Décharge', enabled:'Activé', disabled:'Désactivé', dark:'Sombre:ON', light:'Sombre:OFF', hiconOn:'HautContraste:ON', hiconOff:'HautContraste:OFF', estimated:'Estimé', highPrec:'Haute précision', midPrec:'Précision moyenne' },
        ui: { legendBtn:'🎨 Voir les indicateurs de couleur', shareHint:'💡 Vous pouvez partager sur X depuis le bouton de téléchargement', speedDesc:'Mesure le temps de connexion aux sites principaux.', speedNote:'※ Valeur de référence en raison des limitations du navigateur.', fpsAvgDesc:'(Actualisations d\'écran par seconde. Plus élevé = plus fluide)', fpsLowDesc:'(FPS dans les scènes les plus lourdes. Plus bas = plus de saccades)', uaDesc:'(Chaîne d\'informations sur l\'environnement navigateur/OS)', remaining:'Temps restant est.: ~', seconds:' sec', fpsMeasuring:' sec (mesure FPS)', fpsCalc:'Calcul FPS...', finalizing:'Finalisation...',
            scoreLabel:'Score', memLabel:'BW mémoire', fpsLabel:'Stab. FPS', netLabel:'NET',
            settingsTitle:'⚙️ Paramètres', settingsReset:'🔄 Réinitialiser', settingsResetConfirm:'Réinitialiser tous les paramètres ?',
            secAppearance:'🎨 Apparence', secLanguage:'🌐 Langue', secNotify:'🔔 Notifications', secQuiet:'😴 Heures calmes', secData:'💾 Données',
            labelTheme:'Thème', optDark:'Sombre', optLight:'Clair', optSystem:'Système',
            labelFontSize:'Taille de police', optSmall:'Petit', optNormal:'Normal', optLarge:'Grand', optCustom:'Personnalisé', labelCustomSize:'Taille personnalisée',
            labelLanguage:'Langue', labelTransGuard:'Protection Google Translate', labelSound:'Son de fin', labelVibration:'Vibration',
            labelDesktopNotify:'Notification bureau', labelBadge:"Badge d'app",
            labelQuietStart:'Heure de début', labelQuietEnd:'Heure de fin',
            labelExportFmt:"Format d'export", optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'Unité de vitesse', labelAutoCheck:"Diagnostic auto à l'ouverture", labelGuard:'Protection erreur tactile',
            ipWarnTitle:"⚠️ Inclure l'IP dans la capture ?", ipWarnBody:"Partager votre IP peut révéler emplacement et FAI.",
            ipHide:"🔒 Masquer l'IP (recommandé)", ipMask:'⚠️ Masquer partiellement', ipShow:'Inclure tel quel',
            ipNote:"※ L'IP est utilisée uniquement dans le navigateur.", ipBack:'← Retour (annuler)',
            devWarnTitle:'📱 Inclure le modèle ?', devShow:'Inclure tel quel', devHide:'🔒 Remplacer par *',
            devNote:"※ Le nom de l'appareil provient de l'UA.", devBack:'← Retour',
            loginRequired:'Connexion requise', loginMsg:' nécessite une connexion.', loginBtn:'Se connecter avec Google', cancelBtn:'Annuler', logoutBtn:'Déconnexion',
            syncOk:'✓ Synchronisé', syncing:'Synchronisation...', syncFail:'⚠ Échec sync', synced:'✓ Synchronisation',
            friendCodeTitle:'Connexion avec code ami', friendCodePlaceholder:'Entrez le code...', friendCodeError:'Code incorrect', friendLoginBtn:'Connexion',
            diagComplete:'✅ Diagnostic terminé', imgGenComplete:'✅ Image générée',
            retryConfirm:'Re-diagnostiquer ?\nLes résultats actuels seront écrasés.',
            fpsAvgLabel:'FPS moyen', fpsLowLabel:'1% LOW FPS', uaLabel:'User Agent',
        },
    },
    'de': {
        statusTitle:   'Hardware wird gescannt...',
        evalMsg:       'Komponentenintegrität wird überprüft',
        saveBtnTxt:    'Bericht als Bild speichern',
        saveBtnCSV:    '📊 Als CSV speichern',
        saveBtnPDF:    '📄 Als PDF speichern',
        aiBtnTxt:      '🤖 KI-Berater fragen',
        historyBtnTxt: '📊 Vergangene Ergebnisse ansehen',
        speedBtnTxt:   '⚡ Seitenladegeschwindigkeitstest',
        retryBtnTxt:   '🔄 Neu diagnostizieren',
        rankMsgs: { S:'Spitzenklasse-Leistung', A:'Hochleistungsgerät', B:'Standardleistung', C:'Unterdurchschnittliche Leistung', D:'Altes / Low-End-Gerät' },
        bench: ['CPU-Leistung wird gemessen...','Benchmarks werden ausgeführt','GPU-Rendering wird gemessen...','WebGL- und Canvas-Lasttest','Speicherbandbreite wird gemessen...','Sequentieller und zufälliger Zugriffstest','Systemspeicher wird analysiert...','5 Schätzmethoden werden integriert','Netzwerkgeschwindigkeit wird gemessen...','Daten herunterladen zur Bandbreitenberechnung','Akku und UI-Latenz werden gemessen...','Battery API und UI-Thread-Latenz','Energiesparmodus wird überprüft...','Timer-Genauigkeit wird gemessen','Framerate-Stabilität wird gemessen...','rAF-Jitter-Methode 15-Sekunden-Test'],
        val: { supported:'Unterstützt', unsupported:'Nicht unterstützt', running:'Aktiv', browser:'Browser', secure:'Sicher (HTTPS/TLS)', insecure:'Unverschlüsselt (HTTP)', detected:'⚠ Automatisierung erkannt', normal:'Normal (manuell)', hidden:'Ausgeblendet', measuring:'Nicht messbar', failed:'Messung fehlgeschlagen (offline?)', fast:'Schnell', medium:'Mittel', slow:'Langsam', charging:'⚡ Lädt', discharging:'🔋 Entlädt', enabled:'Aktiviert', disabled:'Deaktiviert', dark:'Dunkel:EIN', light:'Dunkel:AUS', hiconOn:'HohKontrast:EIN', hiconOff:'HohKontrast:AUS', estimated:'Geschätzt', highPrec:'Hohe Genauigkeit', midPrec:'Mittlere Genauigkeit' },
        ui: { legendBtn:'🎨 Farbanzeigen anzeigen', shareHint:'💡 Sie können über den Download-Button in der Vorschau auf X teilen', speedDesc:'Misst die Verbindungszeit zu wichtigen Websites.', speedNote:'※ Nur Referenzwert aufgrund von Browser-Einschränkungen.', fpsAvgDesc:'(Bildschirmaktualisierungen pro Sekunde. Höher = flüssiger)', fpsLowDesc:'(FPS in den schwersten Szenen. Niedriger = mehr Stottern)', uaDesc:'(Browser-/OS-Umgebungsinformationszeichenkette)', remaining:'Geschätzte Restzeit: ~', seconds:' Sek', fpsMeasuring:' Sek (FPS-Messung)', fpsCalc:'FPS wird berechnet...', finalizing:'Wird abgeschlossen...',
            scoreLabel:'Gesamt', memLabel:'Speicher BW', fpsLabel:'FPS Stab.', netLabel:'NET',
            settingsTitle:'⚙️ Einstellungen', settingsReset:'🔄 Zurücksetzen', settingsResetConfirm:'Alle Einstellungen zurücksetzen?',
            secAppearance:'🎨 Erscheinungsbild', secLanguage:'🌐 Sprache', secNotify:'🔔 Benachrichtigungen', secQuiet:'😴 Ruhezeiten', secData:'💾 Daten',
            labelTheme:'Design', optDark:'Dunkel', optLight:'Hell', optSystem:'System',
            labelFontSize:'Schriftgröße', optSmall:'Klein', optNormal:'Normal', optLarge:'Groß', optCustom:'Benutzerdefiniert', labelCustomSize:'Benutzerdefinierte Größe',
            labelLanguage:'Sprache', labelTransGuard:'Google Translate Schutz', labelSound:'Abschluss-Sound', labelVibration:'Vibration',
            labelDesktopNotify:'Desktop-Benachrichtigung', labelBadge:'App-Badge',
            labelQuietStart:'Startzeit', labelQuietEnd:'Endzeit',
            labelExportFmt:'Exportformat', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'Geschwindigkeitseinheit', labelAutoCheck:'Beim Öffnen diagnostizieren', labelGuard:'Tippschutz',
            ipWarnTitle:'⚠️ IP-Adresse im Screenshot?', ipWarnBody:'Ihre IP kann Standort und ISP enthüllen.',
            ipHide:'🔒 IP verbergen (empfohlen)', ipMask:'⚠️ Teilweise maskieren', ipShow:'So einbeziehen',
            ipNote:'※ IP wird nur im Browser verwendet.', ipBack:'← Zurück (Abbrechen)',
            devWarnTitle:'📱 Gerätemodell einschließen?', devShow:'So einbeziehen', devHide:'🔒 Durch * ersetzen',
            devNote:'※ Gerätename stammt aus UA.', devBack:'← Zurück',
            loginRequired:'Anmeldung erforderlich', loginMsg:' erfordert Anmeldung.', loginBtn:'Mit Google anmelden', cancelBtn:'Abbrechen', logoutBtn:'Abmelden',
            syncOk:'✓ Synchronisiert', syncing:'Synchronisierung...', syncFail:'⚠ Sync fehlgeschlagen', synced:'✓ Synchronisierung',
            friendCodeTitle:'Mit Code anmelden', friendCodePlaceholder:'Code eingeben...', friendCodeError:'Falscher Code', friendLoginBtn:'Anmelden',
            diagComplete:'✅ Diagnose abgeschlossen', imgGenComplete:'✅ Bild erstellt',
            retryConfirm:'Neu diagnostizieren?\nAktuelle Ergebnisse werden überschrieben.',
            fpsAvgLabel:'Durchschnittliche FPS', fpsLowLabel:'1% LOW FPS', uaLabel:'User Agent',
        },
    },
    'ru': {
        statusTitle:   'Сканирование оборудования...',
        evalMsg:       'Проверка целостности компонентов',
        saveBtnTxt:    'Сохранить отчёт как изображение',
        saveBtnCSV:    '📊 Сохранить как CSV',
        saveBtnPDF:    '📄 Сохранить как PDF',
        aiBtnTxt:      '🤖 Спросить ИИ-советника',
        historyBtnTxt: '📊 Просмотр прошлых результатов',
        speedBtnTxt:   '⚡ Тест скорости загрузки страниц',
        retryBtnTxt:   '🔄 Диагностировать снова',
        rankMsgs: { S:'Флагманская производительность', A:'Высокопроизводительное устройство', B:'Стандартная производительность', C:'Ниже среднего', D:'Устаревшее / бюджетное устройство' },
        bench: ['Измерение производительности CPU...','Запуск бенчмарков','Измерение рендеринга GPU...','Нагрузочный тест WebGL и Canvas','Измерение пропускной способности памяти...','Последовательный и случайный доступ','Точный анализ системной памяти...','Интеграция 5 методов оценки','Измерение скорости сети...','Загрузка данных для расчёта пропускной способности','Измерение батареи и задержки UI...','Battery API и задержка UI-потока','Проверка режима энергосбережения...','Измерение точности таймера','Измерение стабильности частоты кадров...','Метод дрожания rAF 15 секунд'],
        val: { supported:'Поддерживается', unsupported:'Не поддерживается', running:'Работает', browser:'Браузер', secure:'Защищено (HTTPS/TLS)', insecure:'Не зашифровано (HTTP)', detected:'⚠ Обнаружена автоматизация', normal:'Нормально (вручную)', hidden:'Скрыто', measuring:'Не удаётся измерить', failed:'Измерение не удалось (офлайн?)', fast:'Быстро', medium:'Средне', slow:'Медленно', charging:'⚡ Заряжается', discharging:'🔋 Разряжается', enabled:'Включено', disabled:'Отключено', dark:'Тёмная:ВКЛ', light:'Тёмная:ВЫКЛ', hiconOn:'ВысКонтраст:ВКЛ', hiconOff:'ВысКонтраст:ВЫКЛ', estimated:'Оценка', highPrec:'Высокая точность', midPrec:'Средняя точность' },
        ui: { legendBtn:'🎨 Просмотр цветовых индикаторов', shareHint:'💡 Вы можете поделиться в X через кнопку загрузки в превью', speedDesc:'Измеряет время подключения к основным сайтам.', speedNote:'※ Только справочное значение из-за ограничений браузера.', fpsAvgDesc:'(Обновлений экрана в секунду. Выше = плавнее)', fpsLowDesc:'(FPS в самых тяжёлых сценах. Ниже = больше рывков)', uaDesc:'(Строка информации об окружении браузера/ОС)', remaining:'Осталось примерно: ~', seconds:' сек', fpsMeasuring:' сек (измерение FPS)', fpsCalc:'Расчёт FPS...', finalizing:'Завершение...',
            scoreLabel:'Итог', memLabel:'Пропускная', fpsLabel:'Стаб. FPS', netLabel:'NET',
            settingsTitle:'⚙️ Настройки', settingsReset:'🔄 Сбросить', settingsResetConfirm:'Сбросить все настройки?',
            secAppearance:'🎨 Внешний вид', secLanguage:'🌐 Язык', secNotify:'🔔 Уведомления', secQuiet:'😴 Тихие часы', secData:'💾 Данные',
            labelTheme:'Тема', optDark:'Тёмная', optLight:'Светлая', optSystem:'Системная',
            labelFontSize:'Размер шрифта', optSmall:'Малый', optNormal:'Обычный', optLarge:'Крупный', optCustom:'Свой размер', labelCustomSize:'Свой размер',
            labelLanguage:'Язык', labelTransGuard:'Защита от Google Переводчика', labelSound:'Звук завершения', labelVibration:'Вибрация',
            labelDesktopNotify:'Уведомление рабочего стола', labelBadge:'Значок приложения',
            labelQuietStart:'Начало', labelQuietEnd:'Конец',
            labelExportFmt:'Формат экспорта', optPNG:'PNG', optCSV:'CSV', optPDF:'PDF',
            labelSpeedUnit:'Единица скорости', labelAutoCheck:'Авто-диагностика при открытии', labelGuard:'Защита от случайных нажатий',
            ipWarnTitle:'⚠️ Включить IP-адрес в скриншот?', ipWarnBody:'Публичный IP может раскрыть местоположение и ISP.',
            ipHide:'🔒 Скрыть IP (рекомендуется)', ipMask:'⚠️ Частично маскировать', ipShow:'Оставить как есть',
            ipNote:'※ IP используется только в браузере.', ipBack:'← Назад (отмена)',
            devWarnTitle:'📱 Включить модель устройства?', devShow:'Оставить как есть', devHide:'🔒 Заменить на *',
            devNote:'※ Имя устройства из UA.', devBack:'← Назад',
            loginRequired:'Требуется вход', loginMsg:' требует входа.', loginBtn:'Войти через Google', cancelBtn:'Отмена', logoutBtn:'Выйти',
            syncOk:'✓ Синхронизировано', syncing:'Синхронизация...', syncFail:'⚠ Ошибка sync', synced:'✓ Синхронизация',
            friendCodeTitle:'Войти с кодом друга', friendCodePlaceholder:'Введите код...', friendCodeError:'Неверный код', friendLoginBtn:'Войти',
            diagComplete:'✅ Диагностика завершена', imgGenComplete:'✅ Изображение создано',
            retryConfirm:'Диагностировать снова?\nТекущие результаты будут перезаписаны.',
            fpsAvgLabel:'Средний FPS', fpsLowLabel:'1% LOW FPS', uaLabel:'User Agent',
        },
    },
};

function applyLanguage() {
    try {
    const lang = _settings.language;
    const _tLang = I18N[lang] || I18N['ja'];
    const labels = I18N_LABELS[lang] || I18N_LABELS['ja'];

    // ── 診断項目ラベル切り替え ──
    LABEL_ROW_IDS.forEach((rowId, idx) => {
        try {
            const rowEl = document.getElementById('row-' + rowId);
            if (!rowEl) return;
            const labelEl = rowEl.querySelector('.label');
            if (!labelEl) return;
            const helpSpan = labelEl.querySelector('.help');
            labelEl.textContent = labels[idx] || '';
            if (helpSpan) labelEl.appendChild(helpSpan);
        } catch(e) {}
    });

    // ── UI文字列の更新 ──
    const ui = tui();
    const legendBtn = document.getElementById('legend-btn');
    if (legendBtn) legendBtn.textContent = ui.legendBtn;
    const shareHint = document.getElementById('share-hint');
    if (shareHint) shareHint.textContent = ui.shareHint;

    // FPSパネルのラベルとdescを安全に更新
    try {
        const _infoPanels = document.querySelectorAll('.info-panel');
        [[0, ui.fpsAvgLabel, ui.fpsAvgDesc],
         [1, ui.fpsLowLabel, ui.fpsLowDesc],
         [2, ui.uaLabel,     ui.uaDesc]].forEach(([idx, lbl, desc]) => {
            const panel = _infoPanels[idx];
            if (!panel) return;
            const _label = panel.querySelector('label');
            if (!_label) return;
            // テキストノード（nodeType===3）を安全に更新
            const _firstTxt = Array.from(_label.childNodes).find(n => n.nodeType === 3);
            if (_firstTxt) _firstTxt.textContent = lbl;
            const _d = _label.querySelector('.desc');
            if (_d) _d.textContent = desc;
        });
    } catch(e) {}

    // ── ボタンテキスト（常に更新） ──
    const sb  = document.getElementById('save-btn');
    const ab  = document.getElementById('ai-btn');
    const hb  = document.getElementById('history-btn');
    const spb = document.getElementById('speed-btn');
    const rb  = document.getElementById('retry-btn');
    // save-btnはexportFormatに応じてテキスト変更
    if (sb) {
        const fmt = _settings.exportFormat || 'png';
        if (fmt === 'csv') sb.textContent = _tLang.saveBtnCSV || '📊 CSVで保存する';
        else if (fmt === 'pdf') sb.textContent = _tLang.saveBtnPDF || '📄 PDFで保存する';
        else sb.textContent = _tLang.saveBtnTxt;
    }
    if (ab)  ab.textContent  = _tLang.aiBtnTxt;
    if (hb)  hb.textContent  = _tLang.historyBtnTxt;
    if (spb) spb.textContent = _tLang.speedBtnTxt;
    if (rb)  rb.textContent  = _tLang.retryBtnTxt;

    // ── ランクメッセージ（診断完了後のみ） ──
    try {
        const rankEl = document.getElementById('rank-letter');
        if (rankEl && rankEl.textContent !== '?') {
            const rank    = rankEl.textContent;
            const titleEl = document.getElementById('status-title');
            if (titleEl && _tLang.rankMsgs[rank]) titleEl.textContent = _tLang.rankMsgs[rank];
        }
    } catch(e) {}

    // ── ログイン系テキスト更新 ──
    try {
        const _loginLabel  = document.getElementById('auth-login-label');
        const _logoutBtn   = document.getElementById('auth-logout-btn');
        const _friendLabel = document.getElementById('auth-friend-label');
        const _modalTitle  = document.getElementById('auth-modal-title');
        const _modalLogin  = document.getElementById('auth-modal-login-label');
        const _modalCancel = document.getElementById('auth-modal-cancel');
        if (_loginLabel)  _loginLabel.textContent  = ui.loginBtn;
        if (_logoutBtn)   _logoutBtn.textContent   = ui.logoutBtn;
        if (_friendLabel) _friendLabel.textContent = ui.friendCodeTitle.split('で')[0] || ui.friendCodeTitle;
        if (_modalTitle)  _modalTitle.textContent  = ui.loginRequired;
        if (_modalLogin)  _modalLogin.textContent  = ui.loginBtn;
        if (_modalCancel) _modalCancel.textContent = ui.cancelBtn;
    } catch(e) {}

    // ── フッターバーのテキスト更新 ──
    try {
        const lang = _settings.language;
        const d = TERMS_I18N[lang] || TERMS_I18N['ja'];
        const footerLabel = document.getElementById('footer-terms-label');
        if (footerLabel) footerLabel.textContent = d.footer;
        const fbLabel = document.getElementById('footer-feedback-label');
        const fbD = FB_I18N[lang] || FB_I18N['ja'];
        if (fbLabel) fbLabel.textContent = fbD.title.replace('💬 ', '');
    } catch(e) {}

    } catch(e) { console.warn('applyLanguage error:', e); }
}

// 現在の言語の翻訳オブジェクトを返すヘルパー
function _getLang() { return I18N[_settings.language] || I18N['ja']; }
function tv() { return _getLang().val || I18N['ja'].val; }
function tui() { return _getLang().ui || I18N['ja'].ui; }

function applySettings() {
    // ── テーマ ──
    const root = document.documentElement;
    const theme = _settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : _settings.theme;
    root.setAttribute('data-theme', theme);

    // ── フォントサイズ ──
    const fmap = { small: '13px', normal: '15px', large: '20px', custom: (_settings.customFontSize||15)+'px' };
    root.style.setProperty('--base-font-size', fmap[_settings.fontSize] || '15px');

    // ── フォントファミリー ──
    const fontPresets = {
        'system':  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        'serif':   'Georgia, "Times New Roman", "Hiragino Mincho ProN", "Yu Mincho", serif',
        'mono':    '"SF Mono", "Fira Code", "JetBrains Mono", Consolas, monospace',
        'rounded': '"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", "Nunito", sans-serif',
        'gothic':  '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif',
    };
    const ff = _settings.fontFamily || 'system';
    if (fontPresets[ff]) {
        root.style.setProperty('--app-font', fontPresets[ff]);
    } else {
        // カスタムフォント（Local Font Access APIで取得したもの）
        root.style.setProperty('--app-font', `"${ff}", sans-serif`);
    }

    // ── Google翻訳崩れ防止 ──
    const metaNoTrans = document.querySelector('meta[name="google"]');
    if (_settings.translateGuard) {
        if (!metaNoTrans) {
            const m = document.createElement('meta');
            m.name = 'google'; m.content = 'notranslate';
            document.head.appendChild(m);
        }
        document.documentElement.setAttribute('translate', 'no');
    } else {
        if (metaNoTrans) metaNoTrans.remove();
        document.documentElement.removeAttribute('translate');
    }

    // ── 言語適用 ──
    applyLanguage();
}

// ── 診断終了音（Web Audio API）──
// SE系判定（375x667@2 = SE2/3世代、320x568@2 = SE1世代）
function _isIPhoneSE() {
    const ua = navigator.userAgent;
    if (!/iphone/i.test(ua)) return false;
    const w = screen.width, h = screen.height, dpr = window.devicePixelRatio;
    const key = Math.min(w,h) + 'x' + Math.max(w,h) + '@' + dpr;
    return key === '320x568@2' || key === '375x667@2';
}

// SE系のみ：AudioContextをタップ時に事前初期化して使い回す
let _audioCtx = null;
function _initAudioCtx() {
    if (!_isIPhoneSE() || _audioCtx) return;
    try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
    } catch(e) {}
}
document.addEventListener('touchstart', _initAudioCtx, { once: true });
document.addEventListener('click',      _initAudioCtx, { once: true });

function playDoneSound() {
    if (!_settings.soundOnDone) return;
    const preset = _settings.soundPreset || 'default';

    // カスタム音声ファイル
    if (preset === 'custom' && _settings.soundFileDataUrl) {
        try {
            const audio = new Audio(_settings.soundFileDataUrl);
            audio.volume = 0.7;
            audio.play().catch(() => {});
        } catch(e) {}
        return;
    }

    // SE系は事前初期化した_audioCtxを使い回す、それ以外は毎回新規作成
    try {
        const ctx = (_isIPhoneSE() && _audioCtx)
            ? _audioCtx
            : new (window.AudioContext || window.webkitAudioContext)();

        const play = () => {
            if (preset === 'bell') {
                [880, 1108, 1318].forEach((freq, i) => {
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine'; osc.frequency.value = freq;
                    const t = ctx.currentTime + i * 0.18;
                    gain.gain.setValueAtTime(0.25, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
                    osc.start(t); osc.stop(t + 0.8);
                });
            } else if (preset === 'beep') {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'square'; osc.frequency.value = 880;
                const t = ctx.currentTime;
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                osc.start(t); osc.stop(t + 0.12);
            } else if (preset === 'fanfare') {
                [523, 659, 784, 1047, 784, 1047, 1319].forEach((freq, i) => {
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'triangle'; osc.frequency.value = freq;
                    const t = ctx.currentTime + i * 0.1;
                    gain.gain.setValueAtTime(0.2, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                    osc.start(t); osc.stop(t + 0.15);
                });
            } else {
                [523, 659, 784, 1047].forEach((freq, i) => {
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine'; osc.frequency.value = freq;
                    const t = ctx.currentTime + i * 0.12;
                    gain.gain.setValueAtTime(0.18, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    osc.start(t); osc.stop(t + 0.25);
                });
            }
        };
        if (ctx.state === 'suspended') {
            ctx.resume().then(play).catch(() => {});
        } else {
            play();
        }
    } catch(e) {}
}

// ── バイブレーション ──
function vibrateOnDone() {
    if (!_settings.vibration) return;
    try { navigator.vibrate && navigator.vibrate([100, 50, 100]); } catch(e) {}
}

// ── デスクトップ通知 ──
async function notifyOnDone(rank, score) {
    if (!_settings.desktopNotify) return;
    if (isQuietTime()) return;
    // 許可済みの場合のみ通知（requestPermissionはここでは呼ばない）
    if (Notification.permission === 'granted') {
        new Notification('診断完了！' + rank, {
            body: `総合スコア ${score}点`,
            icon: './android-chrome-192x192.png',
            silent: true
        });
    }
}

// ── バッジ ──
async function setBadge() {
    if (!_settings.badge) return;
    try {
        if (navigator.setAppBadge) await navigator.setAppBadge(1);
    } catch(e) {}
}
async function clearBadge() {
    try {
        if (navigator.clearAppBadge) await navigator.clearAppBadge();
    } catch(e) {}
}

// ── お休み時間チェック ──
function isQuietTime() {
    try {
        const now  = new Date();
        const cur  = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = _settings.quietStart.split(':').map(Number);
        const [eh, em] = _settings.quietEnd.split(':').map(Number);
        const start = sh * 60 + sm;
        const end   = eh * 60 + em;
        if (start > end) return cur >= start || cur < end; // 日をまたぐ場合
        return cur >= start && cur < end;
    } catch(e) { return false; }
}

// ── 通信速度単位変換 ──
function formatSpeed(mbps) {
    if (mbps === null || mbps === undefined) return null;
    if (_settings.speedUnit === 'mbs') {
        return Math.round(mbps / 8 * 10) / 10 + ' MB/s';
    }
    return mbps + ' Mbps';
}

// ── うっかりガード ──
function guardedRetry() {
    if (_settings.clumsiGuard) {
        if (!confirm(tui().retryConfirm)) return;
    }
    retryDiagnostic();
}

// ══════════════════════════════════════════════════════════════
// ⚙️ 設定モーダル UI
// ══════════════════════════════════════════════════════════════
async function openSettings() {
    let modal = document.getElementById('settings-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:999990;display:flex;justify-content:center;align-items:flex-end;padding:0;box-sizing:border-box;overflow-y:auto;';
        document.body.appendChild(modal);
    }

    const ui = tui();
    const _fontRow = await settingFontFamily(ui);
    // ＊の説明文はHELP_TEXT_I18N経由（設定項目は別途）
    // 設定モーダル内の説明文はI18Nから取得
    modal.innerHTML = `
    <div style="background:var(--card);border-radius:24px 24px 0 0;width:100%;max-width:520px;margin:0 auto;max-height:92vh;overflow-y:auto;padding:0 0 40px;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 16px;position:sticky;top:0;background:var(--card);z-index:1;border-radius:24px 24px 0 0;">
            <h2 style="margin:0;font-size:1.2rem;font-weight:900;color:var(--text);">${ui.settingsTitle}</h2>
            <button onclick="closeSettings()" style="background:var(--border);border:none;color:var(--sub-text);width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>

        <div style="padding:0 20px;">
        ${settingSection(ui.secAppearance, [
            settingSelect(ui.labelTheme, 'theme', [['dark',ui.optDark],['light',ui.optLight],['system',ui.optSystem]], 'theme'),
            settingSelect(ui.labelFontSize, 'fontSize', [['small',ui.optSmall],['normal',ui.optNormal],['large',ui.optLarge],['custom',ui.optCustom||'カスタム']], 'fontSize'),
            _settings.fontSize === 'custom' ? settingCustomFontSize(ui.labelCustomSize||'カスタムサイズ') : '',
            _fontRow,
        ].filter(Boolean))}

        ${settingSection(ui.secLanguage, [
            settingSelect(ui.labelLanguage, 'language', [
                ['ja','日本語'],['ja-hira','にほんご'],['en','English'],
                ['zh-hans','中文（简体）'],['zh-hant','中文（繁體）'],['ko','한국어'],
                ['vi','Tiếng Việt'],['es','Español'],['pt','Português'],
                ['fr','Français'],['de','Deutsch'],['ru','Русский'],
            ], 'language'),
            settingToggle(ui.labelTransGuard, 'translateGuard', 'translateGuard'),
        ])}

        ${settingSection(ui.secNotify, [
            settingToggle(ui.labelSound, 'soundOnDone', 'soundOnDone'),
            settingSelect(ui.labelSoundPreset||'サウンドプリセット', 'soundPreset', [
                ['default', ui.soundDefault||'デフォルト（チャイム）'],
                ['bell',    ui.soundBell||'ベル'],
                ['beep',    ui.soundBeep||'ビープ'],
                ['fanfare', ui.soundFanfare||'ファンファーレ'],
                ['custom',  ui.soundCustom||'カスタム（ファイル）'],
            ], 'soundPreset'),
            settingRow(ui.soundPreviewLabel||'プレビュー再生', '<button onclick="playDoneSound()" style="background:var(--accent);color:#fff;border:none;padding:6px 18px;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;">▶ 試聴</button>'),
            _settings.soundPreset === 'custom' ? settingSoundUpload(ui) : '',
            settingToggle(ui.labelVibration, 'vibration', 'vibration'),
            settingToggle(ui.labelDesktopNotify, 'desktopNotify', 'desktopNotify'),
            settingToggle(ui.labelBadge, 'badge', 'badge'),
        ].filter(Boolean))}

        ${settingSection(ui.secQuiet, [
            settingTime(ui.labelQuietStart, 'quietStart', 'quietStart'),
            settingTime(ui.labelQuietEnd, 'quietEnd', 'quietEnd'),
        ])}

        ${settingSection(ui.secData, [
            settingSelect(ui.labelExportFmt, 'exportFormat', [['png',ui.optPNG],['csv',ui.optCSV],['pdf',ui.optPDF||'PDF']], 'exportFormat'),
            settingSelect(ui.labelSpeedUnit, 'speedUnit', [['mbps','Mbps'],['mbs','MB/s']], 'speedUnit'),
            settingToggle(ui.labelAutoCheck, 'autoCheck', 'autoCheck'),
            settingToggle(ui.labelGuard, 'clumsiGuard', 'clumsiGuard'),
        ])}

        </div>
        <div style="padding:0 20px;">
        <button onclick="resetSettings()" style="width:100%;margin-top:16px;padding:12px;border-radius:14px;background:rgba(255,59,48,0.12);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;font-size:0.9rem;font-weight:700;cursor:pointer;">${ui.settingsReset}</button>
        </div>
    </div>`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    modal.onclick = e => { if (e.target === modal) closeSettings(); };
    // ＊ボタンのイベント委譲（初回のみ登録）
    if (!modal._helpListenerAdded) {
        modal._helpListenerAdded = true;
        modal.addEventListener('click', e => {
            const btn = e.target.closest('.setting-help');
            if (!btn) return;
            e.stopPropagation();
            // 現在の言語でHELP_TEXT_I18Nから取得（行番号ベース）
            const rowKey = btn.getAttribute('data-setting-key') || '';
            if (rowKey) {
                const lang = _settings.language;
                const settingDescs = SETTING_HELP_I18N[lang] || SETTING_HELP_I18N['en'];
                alert(settingDescs[rowKey] || settingDescs['default'] || '');
            } else {
                const desc = btn.getAttribute('data-setting-desc') || '';
                alert(desc.replace(/&#10;/g, '\n'));
            }
        });
    }
}

function settingSection(title, rows) {
    return `<div style="margin-bottom:20px;">
        <div style="font-size:0.78rem;font-weight:800;color:var(--sub-text);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${title}</div>
        <div style="background:var(--bg);border-radius:16px;overflow:hidden;border:1px solid var(--border);">
            ${rows.join('')}
        </div>
    </div>`;
}

function settingRow(label, control, descKey) {
    const hasDesc = !!descKey;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);gap:8px;">
        <div style="flex:1;">
            <div style="font-size:0.9rem;color:var(--text);display:flex;align-items:center;gap:4px;">
                ${label}
                ${hasDesc ? `<span class="setting-help" data-setting-key="${descKey}" style="color:var(--sub-text);font-size:0.8rem;cursor:pointer;padding:6px 8px;margin:-6px -4px;user-select:none;">＊</span>` : ''}
            </div>
        </div>
        ${control}
    </div>`;
}

function settingSoundUpload(ui) {
    const hasFile = !!_settings.soundFileDataUrl;
    const label   = ui.labelSoundFile || 'カスタム音声ファイル';
    const hint    = ui.soundFileHint  || 'MP3・WAV・FLACに対応';
    const ctrl    = '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">'
        + '<label style="background:var(--accent);color:#fff;padding:6px 14px;border-radius:10px;font-size:0.82rem;font-weight:700;cursor:pointer;">'
        + (ui.soundUploadBtn || '📁 ファイルを選択')
        + '<input type="file" accept=".mp3,.wav,.flac,audio/*" style="display:none;"'
        + ' onchange="uploadSoundFile(this)">'
        + '</label>'
        + (hasFile
            ? '<span style="color:#34c759;font-size:0.75rem;">✓ ' + (ui.soundFileLoaded || 'ファイル読み込み済み') + '</span>'
              + '<button onclick="clearSoundFile()" style="background:rgba(255,59,48,0.15);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;padding:4px 10px;border-radius:8px;font-size:0.75rem;cursor:pointer;">' + (ui.soundFileClear || '削除') + '</button>'
            : '<span style="color:var(--sub-text);font-size:0.75rem;">' + hint + '</span>')
        + '</div>';
    return settingRow(label, ctrl);
}

function uploadSoundFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        alert('ファイルサイズは5MB以内にしてください。');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        _settings.soundFileDataUrl = e.target.result;
        saveSettings();
        openSettings();
    };
    reader.readAsDataURL(file);
}

function clearSoundFile() {
    _settings.soundFileDataUrl = null;
    saveSettings();
    openSettings();
}

async function settingFontFamily(ui) {
    const label = ui.labelFont || 'フォント';
    const cur   = _settings.fontFamily || 'system';
    const presets = [
        ['system',  ui.fontSystem  || 'システム標準'],
        ['gothic',  ui.fontGothic  || 'ゴシック体'],
        ['serif',   ui.fontSerif   || '明朝体・セリフ'],
        ['rounded', ui.fontRounded || '丸ゴシック'],
        ['mono',    ui.fontMono    || '等幅フォント'],
    ];

    let localFonts = [];
    if ('queryLocalFonts' in window) {
        try {
            const fonts = await window.queryLocalFonts();
            const families = [...new Set(fonts.map(f => f.family))].sort();
            localFonts = families.slice(0, 80);
        } catch(e) {}
    }

    const presetOpts = presets.map(([v, t]) =>
        '<option value="' + v + '" ' + (v === cur ? 'selected' : '') + '>' + t + '</option>'
    ).join('');
    const localOpts = localFonts.length > 0
        ? '<optgroup label="─ インストール済みフォント ─">'
          + localFonts.map(f => '<option value="' + f + '" ' + (f === cur ? 'selected' : '') + '>' + f + '</option>').join('')
          + '</optgroup>'
        : '';

    const ctrl = '<select onchange="changeSetting(\'fontFamily\',this.value)"'
        + ' style="background:var(--card);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:10px;font-size:0.85rem;cursor:pointer;max-width:160px;">'
        + presetOpts + localOpts
        + '</select>';
    return settingRow(label, ctrl, 'fontFamily');
}

async function settingFontFamily(ui) {
    const label = ui.labelFont || 'フォント';
    const cur   = _settings.fontFamily || 'system';
    const presets = [
        ['system',  ui.fontSystem  || 'システム標準'],
        ['gothic',  ui.fontGothic  || 'ゴシック体'],
        ['serif',   ui.fontSerif   || '明朝体・セリフ'],
        ['rounded', ui.fontRounded || '丸ゴシック'],
        ['mono',    ui.fontMono    || '等幅フォント'],
    ];

    let localFonts = [];
    if ('queryLocalFonts' in window) {
        try {
            const fonts = await window.queryLocalFonts();
            const families = [...new Set(fonts.map(f => f.family))].sort();
            localFonts = families.slice(0, 80);
        } catch(e) {}
    }

    const presetOpts = presets.map(([v, t]) =>
        '<option value="' + v + '" ' + (v === cur ? 'selected' : '') + '>' + t + '</option>'
    ).join('');
    const localOpts = localFonts.length > 0
        ? '<optgroup label="─ インストール済みフォント ─">'
          + localFonts.map(f => '<option value="' + f + '" ' + (f === cur ? 'selected' : '') + '>' + f + '</option>').join('')
          + '</optgroup>'
        : '';

    const ctrl = '<select onchange="changeSetting(\'fontFamily\',this.value)"'
        + ' style="background:var(--card);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:10px;font-size:0.85rem;cursor:pointer;max-width:160px;">'
        + presetOpts + localOpts
        + '</select>';
    return settingRow(label, ctrl, 'fontFamily');
}

function settingCustomFontSize(label) {
    const val = _settings.customFontSize || 15;
    const ctrl = '<div style="display:flex;align-items:center;gap:10px;min-width:160px;">'
        + '<input type="range" min="10" max="32" value="' + val + '"'
        + ' oninput="this.nextElementSibling.textContent=this.value+\'px\';changeSetting(\'customFontSize\',parseInt(this.value))"'
        + ' style="flex:1;accent-color:var(--accent);cursor:pointer;">'
        + '<span style="color:var(--text);font-size:0.85rem;font-weight:700;min-width:36px;text-align:right;">' + val + 'px</span>'
        + '</div>';
    return settingRow(label, ctrl);
}
function settingToggle(label, key, descKey) {
    const on = _settings[key];
    return settingRow(label, `
        <div onclick="toggleSetting('${key}')" style="width:48px;height:28px;border-radius:14px;background:${on?'#34c759':'#555'};position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;">
            <div style="position:absolute;top:3px;${on?'right:3px':'left:3px'};width:22px;height:22px;border-radius:50%;background:#fff;transition:all 0.2s;"></div>
        </div>`, descKey);
}

function settingSelect(label, key, options, descKey) {
    const val = _settings[key];
    const opts = options.map(([v,t]) => `<option value="${v}" ${v===val?'selected':''}>${t}</option>`).join('');
    return settingRow(label, `
        <select onchange="changeSetting('${key}',this.value)"
            style="background:var(--card);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:10px;font-size:0.85rem;cursor:pointer;max-width:140px;">
            ${opts}
        </select>`, descKey);
}

function settingTime(label, key, descKey) {
    const val = _settings[key];
    return settingRow(label, `
        <input type="time" value="${val}" onchange="changeSetting('${key}',this.value)"
            style="background:var(--card);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:10px;font-size:0.85rem;cursor:pointer;">`, descKey);
}

function toggleSetting(key) {
    _settings[key] = !_settings[key];
    // 通知系：deniedの場合のみ警告、defaultは起動時の許可フローに任せる
    if ((key === 'desktopNotify' || key === 'badge') && _settings[key]) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
            alert('通知がブラウザでブロックされています。\nブラウザのサイト設定から通知を「許可」に変更してください。');
            _settings[key] = false;
            saveSettings(); openSettings(); return;
        }
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            // 起動時フローと重複しないよう即座に許可要求（toggleで明示的にONにした場合）
            Notification.requestPermission().then(p => {
                if (p !== 'granted') {
                    _settings[key] = false;
                    alert('通知が許可されませんでした。ブラウザの設定から許可してください。');
                }
                saveSettings(); applySettings(); openSettings();
            });
            return;
        }
    }
    saveSettings(); applySettings(); openSettings();
}

function changeSetting(key, val) {
    _settings[key] = val;
    saveSettings(); applySettings();
    // 言語・フォントサイズ選択変更は設定画面を再描画
    if (key === 'language' || key === 'fontSize' || key === 'soundPreset') {
        openSettings();
    }
    // customFontSizeはスライダーなので再描画不要（applySettingsで即反映）
}

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = ''; // スクロールロック解除
}

function resetSettings() {
    if (!confirm(tui().settingsResetConfirm)) return;
    _settings = { ...DEFAULT_SETTINGS };
    saveSettings(); applySettings(); openSettings();
}



/* ── GPU 情報取得（WebGL2/1 両対応） ── */
function getGPUInfo() {
    const r = { renderer:'不明', vendor:'不明', version:'なし', maxTex:0, maxAttrib:0 };
    try {
        let gl = document.createElement('canvas').getContext('webgl2');
        if (gl) { r.version = 'WebGL 2.0'; }
        else {
            gl = document.createElement('canvas').getContext('webgl') ||
                 document.createElement('canvas').getContext('experimental-webgl');
            if (gl) r.version = 'WebGL 1.0'; else { r.version='非対応'; return r; }
        }
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
            r.renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '不明';
            r.vendor   = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)   || '不明';
        }
        r.maxTex    = gl.getParameter(gl.MAX_TEXTURE_SIZE)   || 0;
        r.maxAttrib = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) || 0;
    } catch(e) {}
    return r;
}

/* ── ① CPU ベンチ（素数・行列積・疑似SHA） ── */
/* ── CPU ベンチ（高精度版） ── */
async function benchCPU_pro() {
    const DURATION = 1000;
    const workers = Math.min(4, navigator.hardwareConcurrency || 4);

    const workerCode = `
        const size = 512 * 1024;
        const arr = new Float64Array(size);

        for (let i = 0; i < size; i++) {
            arr[i] = i % 1000;
        }

        function heavyTask() {
            let sum = 0;
            for (let i = 0; i < size; i++) {
                const v = arr[i];
                sum += Math.sqrt(v * 1.001) * Math.sin(v);
            }
            return sum;
        }

        onmessage = () => {
            for (let i = 0; i < 5; i++) heavyTask();

            const start = performance.now();
            let count = 0;

            while (performance.now() - start < ${DURATION}) {
                heavyTask();
                count++;
            }

            postMessage(count);
        }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    const results = await Promise.all(
        Array.from({ length: workers }, () =>
            new Promise(resolve => {
                const w = new Worker(url);
                w.onmessage = e => {
                    resolve(e.data);
                    w.terminate();
                };
                w.postMessage(0);
            })
        )
    );

    URL.revokeObjectURL(url);

    const total = results.reduce((a, b) => a + b, 0);
    const normalized = total / workers;

    let factor = 1.5;

if (/iPhone|iPad/.test(navigator.userAgent)) factor = 1.85;
else if (/Android/.test(navigator.userAgent)) factor = 1.65;
else factor = 1.45;

    return Math.min(100, Math.round(normalized * factor));
}

/* ── ② GPU ベンチ（WebGL シェーダー + Canvas 2D 合成） ── */
function benchGPU() {
    const t0 = performance.now();
    // A) WebGL 三角形ストリップ大量描画
    try {
        const cv=document.createElement('canvas'); cv.width=cv.height=512;
        const gl=cv.getContext('webgl')||cv.getContext('experimental-webgl');
        if(gl){
            const vs=gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vs,'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'); gl.compileShader(vs);
            const fs=gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fs,'precision mediump float;void main(){gl_FragColor=vec4(0.2,0.6,1.0,1.0);}'); gl.compileShader(fs);
            const prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog); gl.useProgram(prog);
            const verts=new Float32Array(2000); for(let i=0;i<verts.length;i++)verts[i]=Math.random()*2-1;
            const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
            const loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
            for(let i=0;i<300;i++) gl.drawArrays(gl.TRIANGLES,0,900);
            gl.finish();
        }
    } catch(e) {}
    // B) Canvas 2D 高負荷（グラデーション・ベジェ・合成モード）
    const cv2=document.createElement('canvas'); cv2.width=cv2.height=1024;
    const ctx=cv2.getContext('2d');
    const modes=['source-over','multiply','screen','overlay'];
    for(let i=0;i<600;i++){
        const x=Math.random()*1024,y=Math.random()*1024,r=15+Math.random()*55;
        ctx.globalCompositeOperation=modes[i&3];
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,`hsl(${i*0.6%360},80%,60%)`); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
    for(let i=0;i<400;i++){
        ctx.beginPath(); ctx.moveTo(Math.random()*1024,Math.random()*1024);
        ctx.bezierCurveTo(Math.random()*1024,Math.random()*1024,Math.random()*1024,Math.random()*1024,Math.random()*1024,Math.random()*1024);
        ctx.strokeStyle=`hsla(${i*1.5%360},70%,60%,0.5)`; ctx.stroke();
    }
    const ms = performance.now()-t0;
    // 基準: ハイエンド~40ms, 高性能~100ms, ミドル~280ms, ロー~600ms+
    return Math.max(0,Math.min(100,Math.round((600-ms)/5.8)));
}

/* ── ③ メモリ帯域ベンチ（シーケンシャル・ストライド・ランダム） ── */
function benchMemory() {
    // 2MB に縮小して計測時間を安定させる
    const SIZE = 2 * 1024 * 1024; // 2M floats = 8MB
    let buf;
    try { buf = new Float32Array(SIZE); } catch(e) { return 15; }

    // ウォームアップ（JITコンパイルを促す）
    for (let i = 0; i < 1000; i++) buf[i] = i;

    const t0 = performance.now();
    // シーケンシャル書き込み
    for (let i = 0; i < SIZE; i++) buf[i] = i * 0.001;
    // シーケンシャル読み込み
    let sum = 0;
    for (let i = 0; i < SIZE; i++) sum += buf[i];
    // ストライドアクセス
    for (let i = 0; i < SIZE; i += 64) sum += buf[i];
    if (sum === 0) buf[0] = 1;
    const ms = performance.now() - t0;

    // 基準（8MB実測）:
    //   ハイエンドPC   ~5ms  → ~100点
    //   高性能スマホ   ~20ms → ~75点
    //   Chromebook     ~60ms → ~45点
    //   ローエンド     ~150ms→ ~10点
    //   200ms超        → 0点
    // 対数スケールで評価（遅い端末も差がつくよう）
    const score = Math.round(100 - Math.log(ms + 1) / Math.log(200) * 100);
    return Math.max(0, Math.min(100, score));
}

/* ── ④ FPS精密計測（15秒・rAF遅延ギャップ方式）
 *
 *  「負荷をかけてドロップを測る」は間違い：
 *    負荷が重すぎ → 全端末30FPS（測定が重すぎる自己矛盾）
 *    負荷が軽すぎ → 全端末60FPS（Vsync固定）
 *    適切な負荷量は端末ごとに違いすぎて自動調整が困難。
 *
 *  正解：rAF遅延ギャップ（Scheduling Jitter）方式
 *    requestAnimationFrame()を呼んだ瞬間の時刻 t_request と
 *    コールバックが実際に実行された時刻 t_actual の差を測る。
 *    t_actual - t_request - expected_interval = スケジューリング遅延
 *    これはブラウザ・OSのタスクスケジューラ負荷を直接反映し、
 *    端末性能の差がそのまま出る。負荷は一切かけない。
 *    15秒・数百サンプルで統計的に安定した値を得る。
 * ── */
function runFPSBench(onComplete) {
    const _pcv=document.createElement('canvas');
    _pcv.width=_pcv.height=400;
    _pcv.style.cssText='position:fixed;left:-9999px;top:-9999px;pointer-events:none;';
    document.body.appendChild(_pcv);
    const _pct=_pcv.getContext('2d');
    const _pts=Array.from({length:120},()=>({x:Math.random()*400,y:Math.random()*400,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,r:2+Math.random()*6,hue:Math.random()*360}));
    function _dp(){
        _pct.fillStyle='rgba(0,0,0,0.15)';_pct.fillRect(0,0,400,400);
        for(const p of _pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>400)p.vx*=-1;if(p.y<0||p.y>400)p.vy*=-1;p.hue=(p.hue+1)%360;const g=_pct.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);g.addColorStop(0,`hsla(${p.hue},80%,60%,0.9)`);g.addColorStop(1,`hsla(${p.hue},80%,60%,0)`);_pct.fillStyle=g;_pct.beginPath();_pct.arc(p.x,p.y,p.r,0,Math.PI*2);_pct.fill();}
    }
    const TOTAL_MS  = 15000;
    const WARMUP_MS = 1000;
    const startTs   = performance.now();

    // Phase-1: 無負荷で真のリフレッシュレートを特定（最初の2秒）
    const phase1 = [];
    let last1 = performance.now();

    function tickPhase1() {
        const now = performance.now();
        const d   = now - last1;
        last1 = now;
        if (d > 2 && d < 100) phase1.push(d);
        if (now - startTs < 2000) { requestAnimationFrame(tickPhase1); return; }

        // 最速フレーム群の最頻値からリフレッシュレートを確定
        const sorted1 = [...phase1].sort((a,b)=>a-b);
        const fastest = sorted1.slice(0, Math.max(5, Math.floor(sorted1.length * 0.15)));
        const bkts    = {};
        for (const d of fastest) {
            const k = Math.round(d * 4) / 4;
            bkts[k] = (bkts[k]||0) + 1;
        }
        const modeMs = parseFloat(Object.entries(bkts).sort((a,b)=>b[1]-a[1])[0][0]);
        const rates  = [24,30,48,60,90,120,144,165,240,360];
        let rr       = Math.round(1000 / modeMs);
        rr = rates.reduce((p,c)=>Math.abs(c-rr)<Math.abs(p-rr)?c:p);

        // Phase-2 開始
        tickPhase2_start(rr, modeMs);
    }
    requestAnimationFrame(tickPhase1);

    function tickPhase2_start(rr, nominalMs) {
        // rAF遅延ギャップ方式：
        //   requestAnimationFrame()を呼んだ時刻を記録 → コールバック内で差を取る
        //   この差が0に近い = スケジューラが正確 = 高性能
        //   この差が大きい  = 他タスクで遅延 = 低性能
        const gaps        = []; // スケジューリング遅延の記録
        const frameTimes  = []; // 実フレーム間隔
        let lastFrame     = performance.now();
        let requestedAt   = performance.now();
        let displayTimer  = 0;
        const phase2Start = performance.now();

        function tickPhase2() {
            const actual  = performance.now();
            _dp();
            // ── フレーム間隔（actual - lastFrame）──
            const frameGap = actual - lastFrame;
            lastFrame = actual;
            if (frameGap > 2 && frameGap < 500) frameTimes.push(frameGap);

            // ── スケジューリング遅延（actual - requestedAt - nominalMs）──
            // rAFを要求してから実際に呼ばれるまでの「余分な待ち時間」
            const schedDelay = Math.max(0, (actual - requestedAt) - nominalMs);
            if (actual - phase2Start > WARMUP_MS) gaps.push(schedDelay);

            // リアルタイム表示
            displayTimer += frameGap;
            if (displayTimer >= 500 && frameTimes.length >= 20) {
                displayTimer = 0;
                const rec    = frameTimes.slice(-60);
                const recAvg = rec.reduce((a,b)=>a+b,0) / rec.length;
                document.getElementById('b-fps-avg').textContent =
                    Math.min(rr, Math.round(1000/recAvg)) + ' FPS';
            }

            if (actual - startTs < TOTAL_MS) {
                // 次フレームを要求する直前の時刻を記録
                requestedAt = performance.now();
                requestAnimationFrame(tickPhase2);
                return;
            }

// ── 集計 ──
            if (frameTimes.length < 30) { onComplete(30, 20, 30, rr); return; }

            // 1. 全フレームの合計時間から平均を算出（カクつきを反映させる）
            const sumTimes = frameTimes.reduce((a, b) => a + b, 0);
            const avgTime  = sumTimes / frameTimes.length;

            // 2. 1% Lowに近い値（下位3%）を出すためにソート
            const sorted  = [...frameTimes].sort((a,b)=>a-b);
            const p97     = sorted[Math.floor(sorted.length * 0.97)];
            
            const avgFps = Math.min(rr, Math.round(1000 / avgTime));
            const lowFps = Math.min(rr, Math.round(1000 / p97));

            // 3. ジッター（安定性）スコアの計算
            const gapMed  = gaps.length > 0
                ? [...gaps].sort((a,b)=>a-b)[Math.floor(gaps.length*0.5)] : 0;
            const gapMean = gaps.reduce((a,b)=>a+b,0) / (gaps.length||1);
            const gapSd   = Math.sqrt(gaps.reduce((a,b)=>a+(b-gapMean)**2,0)/(gaps.length||1));
            const jScore  = Math.max(0, Math.min(100, Math.round(100 - (gapMed + gapSd) * 6)));

            // 4. 不要な要素の削除とジャンクフレーム数のカウント
            try{document.body.removeChild(_pcv);}catch(e){}
            const _j32 = frameTimes.filter(d=>d>32).length;
            const _j17 = frameTimes.filter(d=>d>16.7).length;

            // 5. 結果を返して終了
            onComplete(avgFps, lowFps, jScore, rr, _j32, _j17);
        }

        requestedAt = performance.now();
        requestAnimationFrame(tickPhase2);
    }
}

/* ── ⑤ 高精度メモリ推定（安全・高速・実測なし版） ── */
async function estimateMemoryPrecise() {
    const ev = [];

    // 1. 標準APIから取得 (AndroidやPCなどで有効)
    if (navigator.deviceMemory) {
        const raw = navigator.deviceMemory;
        ev.push({ v: raw, w: 5, src: `API:${raw}GB` });
    }

    // 2. JSヒープ上限から推定 (iOSなどで有効)
    if (window.performance?.memory?.jsHeapSizeLimit) {
        const mb = performance.memory.jsHeapSizeLimit / 1048576;
        const tbl = [[14000, 32], [7000, 16], [3500, 8], [1800, 4], [900, 2], [0, 1]];
        const est = (tbl.find(([th]) => mb >= th) || [0, 1])[1];
        ev.push({ v: est, w: 5, src: `heap:${Math.round(mb)}MB→${est}GB` });
    }

    // 3. CPUコア数からの推定
    const cores = navigator.hardwareConcurrency || 2;
    const cMap = [[24, 64], [16, 32], [12, 16], [8, 8], [6, 6], [4, 4], [2, 2], [0, 1]];
    const cEst = (cMap.find(([th]) => cores >= th) || [0, 1])[1];
    ev.push({ v: cEst, w: 1, src: `cores:${cores}→${cEst}GB` });

    // 4. Google Pixel モデル名による強制固定（Android UA から機種名を直接取得）
    // UA例: "...Android 14; Pixel 8 Pro Build/..."
    const _pixelMatch = navigator.userAgent.match(/;\s*(Pixel\s+[\w\s]+?)\s+Build\//i);
    if (_pixelMatch) {
        const _pixelName = _pixelMatch[1].toLowerCase().trim();
        // Pixel 8 / 8 Pro / 8a → 8GB
        // Pixel 7 / 7 Pro / 7a → 8GB
        // Pixel 6 / 6 Pro / 6a → 8GB
        // Pixel 5 / 5a          → 8GB
        if (/pixel\s+[5-9]|pixel\s+[1-9][0-9]/.test(_pixelName)) {
            return { gb: 8, label: '8 GB', confLabel: '高精度', detail: 'Pixel5以降確定8GB' };
        }
        // Pixel 4 / 4 XL / 4a → 6GB
        if (/pixel\s+4/.test(_pixelName)) {
            return { gb: 6, label: '6 GB', confLabel: '高精度', detail: 'Pixel4確定6GB' };
        }
        // Pixel 3 / 3 XL / 3a → 4GB
        if (/pixel\s+3/.test(_pixelName)) {
            return { gb: 4, label: '4 GB', confLabel: '高精度', detail: 'Pixel3確定4GB' };
        }
        // Pixel 2 / 2 XL → 4GB
        if (/pixel\s+2/.test(_pixelName)) {
            return { gb: 4, label: '4 GB', confLabel: '高精度', detail: 'Pixel2確定4GB' };
        }
        // Pixel 1 → 4GB
        if (/pixel\s+1|pixel\b(?!\s+[2-9])/.test(_pixelName)) {
            return { gb: 4, label: '4 GB', confLabel: '高精度', detail: 'Pixel1確定4GB' };
        }
    }

    // 5. iPhoneモデル番号による強制固定（最優先・加重平均を無視して確定）
    // UAの "iPhoneXX,YY" からモデル世代番号を取得
    const _iphoneModelMatch = navigator.userAgent.match(/iPhone(\d+),(\d+)/);
    if (_iphoneModelMatch) {
        const _igen = parseInt(_iphoneModelMatch[1]);
        // gen17 = iPhone 16系 / gen16 = iPhone 15 Pro系 / gen15 = iPhone 15系 → 全部8GB
        if (_igen >= 15) {
            return { gb: 8, label: '8 GB', confLabel: '高精度', detail: 'iPhone15以降確定8GB' };
        }
        // gen14 = iPhone 14 / 14 Plus → 6GB
        if (_igen === 14) {
            return { gb: 6, label: '6 GB', confLabel: '高精度', detail: 'iPhone14確定6GB' };
        }
        // gen13 = iPhone 13系 / gen12 = iPhone 12系 → 4GB
        if (_igen === 13 || _igen === 12) {
            return { gb: 4, label: '4 GB', confLabel: '高精度', detail: 'iPhone12-13確定4GB' };
        }
        // gen11以下 = iPhone 11以前 → 3〜4GB
        if (_igen <= 11) {
            return { gb: 3, label: '3 GB', confLabel: '高精度', detail: 'iPhone11以前確定3GB' };
        }
    }

    // 5b. SafariはUAにモデル番号を含めないのでiOSバージョンで推定
    // "iPhone OS 18_x" → iOS 18 → iPhone 15/16世代 → 8GB
    if (/iPhone/.test(navigator.userAgent)) {
        const _iosMatch = navigator.userAgent.match(/iPhone OS (\d+)_/);
        if (_iosMatch) {
            const _iosVer = parseInt(_iosMatch[1]);
            // iOS 17以上 = iPhone 15以降 → 8GB確定
            if (_iosVer >= 17) {
                return { gb: 8, label: '8 GB', confLabel: '精度中', detail: 'iOS' + _iosVer + '→iPhone15以降推定8GB' };
            }
            // iOS 16 = iPhone 14世代 → 6GB
            if (_iosVer === 16) {
                return { gb: 6, label: '6 GB', confLabel: '精度中', detail: 'iOS16→iPhone14世代推定6GB' };
            }
            // iOS 15 = iPhone 13世代 → 4GB
            if (_iosVer === 15) {
                return { gb: 4, label: '4 GB', confLabel: '精度中', detail: 'iOS15→iPhone13世代推定4GB' };
            }
            // iOS 14以下 → 4GB以下
            if (_iosVer <= 14) {
                return { gb: 4, label: '4 GB', confLabel: '精度中', detail: 'iOS14以下→旧世代推定4GB' };
            }
        }
    }

    // 6. GPUの種類から極限まで正確に推測する
    const gpuInfo = getGPUInfo();
    const gpuStr = (gpuInfo.renderer || "").toLowerCase();
    
    let bonus = 0;
    let weight = 0;

    // --- Apple デバイス（iPhone / iPad / Mac）の精密判定 ---
    if (/a18/.test(gpuStr)) { bonus = 8; weight = 15; } // iPhone 16シリーズは全機種8GB確定
    else if (/a17/.test(gpuStr)) { bonus = 8; weight = 15; } // iPhone 15 Pro は8GB確定
    else if (/a16/.test(gpuStr)) { bonus = 6; weight = 10; } // iPhone 14 Pro / 15 は6GB
    else if (/a15/.test(gpuStr)) { bonus = 4; weight = 10; } // iPhone 13 等
    else if (/apple m[3-9]/.test(gpuStr)) { bonus = 16; weight = 8; } // 最新Mac/iPad Pro
    else if (/apple m[12]/.test(gpuStr)) { bonus = 8; weight = 8; } // 初期M1/M2

    // --- Android ハイエンドの精密判定 ---
    else if (/snapdragon 8 gen [3-9]|dimensity 9[3-9]/.test(gpuStr)) { bonus = 12; weight = 6; } // 最新ハイエンドは12GB〜16GBが多い
    else if (/snapdragon 8 gen [12]|dimensity 9[012]/.test(gpuStr)) { bonus = 8; weight = 6; }

    // --- PC用グラボの精密判定 ---
    else if (/rtx [4-9]|rx 7[89]/.test(gpuStr)) { bonus = 32; weight = 6; } // ハイエンドPC

    if (bonus > 0) {
        ev.push({ v: bonus, w: weight, src: `gpu→${bonus}GB` });
    }

    // ── 最終集計 ──
    if (ev.length === 0) return { gb: 4, label: '4 GB', confLabel: '推定', detail: 'no data' };
    
    const totalW = ev.reduce((s, e) => s + e.w, 0);
    const rawAvg = ev.reduce((s, e) => s + e.v * e.w, 0) / totalW;
    
    const tiers = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
    const snapped = tiers.reduce((p, c) => Math.abs(c - rawAvg) < Math.abs(p - rawAvg) ? c : p);
    
    const conf = totalW >= 12 ? '高精度' : totalW >= 7 ? '精度中' : '推定';
    const detailText = ev.map(e => e.src).join(' | ');

    return { 
        gb: snapped, 
        label: `${snapped} GB`, 
        confLabel: conf, 
        detail: detailText 
    };
}

/* ── ブラウザ名・デバイス名取得 ── */
function detectBrowser() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua))           return 'Microsoft Edge';
    if (/OPR\/|Opera/.test(ua))     return 'Opera';
    if (/SamsungBrowser/.test(ua))  return 'Samsung Internet';
    if (/CriOS/.test(ua))           return 'Chrome (iOS)';
    if (/FxiOS/.test(ua))           return 'Firefox (iOS)';
    if (/Firefox\//.test(ua))       return 'Firefox';
    if (/Chrome\//.test(ua) && /CrOS/.test(ua)) return 'Google Chrome';
    if (/Chrome\//.test(ua))        return 'Google Chrome';
    if (/Safari\//.test(ua) && /Mobile/.test(ua)) return 'Safari (Mobile)';
    if (/Safari\//.test(ua))        return 'Safari';
    return 'ブラウザを特定できません。';
}

function detectDeviceName() {
    const ua = navigator.userAgent;

    // ===== iPhone =====
    if (/iPhone/.test(ua)) {
        const w   = screen.width;
        const h   = screen.height;
        const dpr = window.devicePixelRatio;
        const key = `${w}x${h}@${dpr}`;

        // iOSバージョンを取得（世代判定に使用）
        const _iosM = ua.match(/iPhone OS (\d+)_/);
        const _ios  = _iosM ? parseInt(_iosM[1]) : 0;

        // モデル番号を取得（Chromeなど一部ブラウザで取得可能）
        const _modelM = ua.match(/iPhone(\d+),/);
        const _mgen   = _modelM ? parseInt(_modelM[1]) : 0;

        // ── SE系（解像度で確定） ──
        if (key === '320x568@2') return 'iPhone SE (第1世代)';
        if (key === '375x667@2') return 'iPhone SE (第2/3世代)';

        // ── mini系 ──
        if (key === '360x780@3') return 'iPhone 12 / 13 mini';

        // ── 標準 6.1インチ系 390x844 ──
        // 12/13/14 が同じ解像度
        if (key === '390x844@3') {
            if (_mgen === 14 || _mgen === 15 && false) return 'iPhone 14';  // gen14,7/14,8
            if (_ios >= 18) return 'iPhone 14';  // iOS18でこの解像度 = 14
            if (_ios === 17) return 'iPhone 14';
            if (_ios === 16) return 'iPhone 14';
            return 'iPhone 12 / 13 / 14';
        }

        // ── Pro 6.1インチ系 393x852 ──
        // 14 Pro / 15 / 15 Pro / 16 / 16 Pro が同じ解像度
        if (key === '393x852@3') {
            if (_mgen >= 17) return 'iPhone 16 (Pro)';   // gen17,1=16Pro gen17,3=16
            if (_mgen === 16) return 'iPhone 15 (Pro)';  // gen16,1=15Pro
            if (_mgen === 15 && _mgen >= 4) return 'iPhone 15'; // gen15,4=15
            // iOSバージョンで推定
            if (_ios >= 18) return 'iPhone 16 (Pro)';
            if (_ios === 17) return 'iPhone 15 (Pro)';
            if (_ios === 16) return 'iPhone 14 Pro';
            return 'iPhone 14 Pro / 15 / 16';
        }

        // ── Plus / Pro Max 6.7インチ系 430x932 ──
        // 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus / 16 Pro Max
        if (key === '430x932@3') {
            if (_mgen >= 17) return 'iPhone 16 Plus (Pro Max)';
            if (_mgen === 16) return 'iPhone 15 Plus (Pro Max)';
            if (_ios >= 18) return 'iPhone 16 Plus (Pro Max)';
            if (_ios === 17) return 'iPhone 15 Plus (Pro Max)';
            if (_ios === 16) return 'iPhone 14 Pro Max';
            return 'iPhone 14 Pro Max / 15 Plus / 16 Plus';
        }

        // ── 旧XR/11系 ──
        if (key === '414x896@2') return 'iPhone XR / 11';
        if (key === '414x896@3') return 'iPhone XS Max / 11 Pro Max';

        // ── X/XS/11 Pro ──
        if (key === '375x812@3') return 'iPhone X / XS / 11 Pro';

        // ── 6/7/8系 ──
        if (key === '375x667@3') return 'iPhone 6 / 7 / 8';
        if (key === '414x736@3') return 'iPhone 6 Plus / 7 Plus / 8 Plus';

        return 'iPhone';
    }

    // ===== iPad =====
    if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        const w = screen.width;
        const h = screen.height;

        if (w === 1024 && h === 1366) return "iPad Pro 12.9";
        if (w === 834 && h === 1194) return "iPad Pro 11";
        if (w === 820 && h === 1180) return "iPad Air";
        if (w === 810 && h === 1080) return "iPad (第10世代)";
        if (w === 768 && h === 1024) return "iPad mini";

        return "iPad";
    }

    // ===== Android =====
    let m = ua.match(/Android[^;]*;\s*([^)]+)\)/);
    if (m) {
        let name = m[1].trim().replace(/Build\/.*$/, '').trim();
        name = name.replace(/_/g, " ").replace(/\s+/g, " ");
        return name;
    }

 　 // ===== Chromebook =====
    if (/CrOS/.test(ua)) {
        return "Chromebook";
    }
    
    // ===== Windows =====
    if (/Windows NT/.test(ua)) return "Windows";

    // ===== Mac =====
    if (/Macintosh/.test(ua)) {
        const isARM = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
        return isARM ? "Mac (Apple Silicon)" : "Mac (Intel)";
    }

    // ===== Linux =====
    if (/Linux/.test(ua)) return "Linux";

    return "";
}

/* ── ⑥-a IP取得（WebRTC + 外部API フォールバック） ── */
async function fetchPublicIP() {
    // 手法1: WebRTC でローカルIP・候補IPを取得（サーバー不要・Chromebook対応）
    const webrtcIP = await getIPviaWebRTC();
    if (webrtcIP) return webrtcIP;

    // 手法2: 外部APIフォールバック（ネットワーク制限がない環境向け）
    const apis = [
        { url: 'https://api.ipify.org?format=json',   parse: j => j.ip },
        { url: 'https://api64.ipify.org?format=json', parse: j => j.ip },
        { url: 'https://ipapi.co/json/',              parse: j => j.ip },
    ];
    for (const api of apis) {
        try {
            const r = await fetch(api.url, { cache:'no-store', mode:'cors' });
            if (!r.ok) continue;
            const j = await r.json();
            const ip = api.parse(j);
            if (ip && /^[\d.:a-fA-F]+$/.test(ip)) return ip;
        } catch(e) { continue; }
    }
    return null;
}

/* WebRTC ICE candidate からIPv4アドレスのみ厳密に抽出 */
function getIPviaWebRTC() {
    return new Promise(resolve => {
        const ips = new Set();
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            const all = [...ips];
            // パブリックIPを優先、なければプライベート
            const pub = all.find(ip => !isPrivateIP(ip));
            resolve(pub || all[0] || null);
        };

        try {
            const pc = new RTCPeerConnection({ iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]});
            pc.createDataChannel('');
            pc.onicecandidate = e => {
                if (!e.candidate) { done(); return; }
                const cand = e.candidate.candidate;
                // ICE candidateのフォーマット: "candidate:... IP port ..."
                // IPv4アドレスのみ厳密に抽出（4オクテット、各0-255）
                const parts = cand.split(' ');
                // candidateフォーマット: foundation component protocol ip port ...
                // インデックス4がIP、5がポート
                if (parts.length >= 6) {
                    const ip = parts[4];
                    // 厳密なIPv4バリデーション
                    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
                        const octs = ip.split('.').map(Number);
                        if (octs.every(o => o >= 0 && o <= 255) && ip !== '0.0.0.0') {
                            ips.add(ip);
                        }
                    }
                }
            };
            pc.createOffer().then(o => pc.setLocalDescription(o));
            setTimeout(() => { pc.close(); done(); }, 5000);
        } catch(e) { resolve(null); }
    });
}

function isPrivateIP(ip) {
    return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|fc|fd|fe80)/i.test(ip);
}

/* ── ⑥ ネットワーク実測 ── */
async function measureNetworkSpeed() {
    const url='https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js';
    try {
        const t0=performance.now();
        const resp=await fetch(url+'?_='+Date.now(),{cache:'no-store',mode:'cors'});
        const buf=await resp.arrayBuffer();
        const ms=performance.now()-t0;
        const mbps=(buf.byteLength/1024*8)/ms;
        return Math.round(mbps*10)/10;
    } catch(e){ return null; }
}

/* ── ⑦ バッテリー情報 ── */
async function getBatteryInfo() {
    try {
        if(!navigator.getBattery) return null;
        const bat=await navigator.getBattery();
        return {level:Math.round(bat.level*100),charging:bat.charging,chargingTime:bat.chargingTime,dischargingTime:bat.dischargingTime};
    } catch(e){ return null; }
}

/* ── ⑧ レイテンシ計測（rAF→postMessage往復時間でUIスレッド遅延を測定） ── */
function measureUILatency() {
    return new Promise(resolve => {
        const samples = [];
        let count = 0;
        const MAX = 30;
        function measure() {
            const t0 = performance.now();
            requestAnimationFrame(() => {
                const channel = new MessageChannel();
                channel.port1.onmessage = () => {
                    samples.push(performance.now() - t0);
                    count++;
                    if (count < MAX) measure();
                    else {
                        const sorted = [...samples].sort((a,b)=>a-b);
                        const med = sorted[Math.floor(sorted.length * 0.5)];
                        const p95 = sorted[Math.floor(sorted.length * 0.95)];
                        resolve({ medMs: Math.round(med*10)/10, p95Ms: Math.round(p95*10)/10 });
                    }
                };
                channel.port2.postMessage(null);
            });
        }
        measure();
    });
}

/* ── メインベンチフロー ── */
// Safari低電力モード検出：setTimeoutが意図的に間引かれているか確認
async function detectSafariThrottle() {
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    if (!isSafari) return false; // Safari以外は対象外

    // 1ms指定で10回計測して実際の間隔を確認
    const samples = [];
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => {
            const t0 = performance.now();
            setTimeout(() => {
                samples.push(performance.now() - t0);
                resolve();
            }, 1);
        });
    }
    const avg = samples.reduce((a,b)=>a+b,0) / samples.length;
    // 通常は1〜3ms、低電力モードでは20ms以上に間引かれる
    return avg > 15;
}

async function runBenchmark() {
    const el=document.getElementById('status-title');
    const msg=document.getElementById('eval-msg');
    const timeEl=document.getElementById('time-remaining');
    const _tb = () => _getLang().bench || I18N['ja'].bench;
    const _tui = () => tui();

    // 推定残り時間タイマー
    const TOTAL_EST = 25;
    const benchStart = performance.now();
    let timerInterval = setInterval(() => {
        const elapsed = (performance.now() - benchStart) / 1000;
        const remaining = Math.max(0, Math.ceil(TOTAL_EST - elapsed));
        if (timeEl) {
            const ui = _tui();
            if (remaining > 0) {
                timeEl.textContent = ui.remaining + remaining + ui.seconds;
            } else {
                timeEl.textContent = ui.finalizing;
            }
        }
    }, 1000);
    diag._stopTimer = () => {
        clearInterval(timerInterval);
        if (timeEl) timeEl.textContent = '';
    };

    el.textContent=_tb()[0];
    msg.textContent=_tb()[1];
    await wait(80);

// ウォームアップ（捨て）
await benchCPU_pro();

// 本番2回
const s1 = await benchCPU_pro();
const s2 = await benchCPU_pro();
const s3 = await benchCPU_pro();
// 平均
const arr = [s1, s2, s3].sort((a, b) => a - b);
scores.cpu = arr[1]; // 真ん中だけ採用（中央値）

    el.textContent=_tb()[2];
    msg.textContent=_tb()[3];
    await wait(50);
    scores.gpu=benchGPU();

    el.textContent=_tb()[4];
    msg.textContent=_tb()[5];
    await wait(50);
    scores.mem=benchMemory();

    el.textContent=_tb()[6];
    msg.textContent=_tb()[7];
    await wait(40);
    diag.memResult=await estimateMemoryPrecise();

    el.textContent=_tb()[8];
    msg.textContent=_tb()[9];
    [diag.networkMbps, diag.publicIP] = await Promise.all([measureNetworkSpeed(), fetchPublicIP()]);

    el.textContent=_tb()[10];
    msg.textContent=_tb()[11];
    [diag.battery, diag.latency] = await Promise.all([getBatteryInfo(), measureUILatency()]);

    diag.gpu=getGPUInfo();

    // ── Safari低電力モード検出（setTimeout間引き確認）──
    el.textContent=_tb()[12];
    msg.textContent=_tb()[13];
    diag.safariThrottled = await detectSafariThrottle();

    el.textContent=_tb()[14];
    msg.textContent=_tb()[15];
    // FPSは15秒固定なので残り時間を15秒にリセット
    if (diag._stopTimer) { diag._stopTimer(); }
    const fpsStart = performance.now();
    const fpsTimerEl = document.getElementById('time-remaining');
    const fpsTimer = setInterval(() => {
        const rem = Math.max(0, Math.ceil(15 - (performance.now()-fpsStart)/1000));
        const ui = tui();
        if (fpsTimerEl) fpsTimerEl.textContent = rem > 0 ? ui.remaining + rem + ui.fpsMeasuring : ui.fpsCalc;
    }, 1000);

    runFPSBench((avgFps,lowFps,jitterScore,refreshRate,jank32,jank17) => {
        clearInterval(fpsTimer);
        if (fpsTimerEl) fpsTimerEl.textContent = '';
        scores.fps=jitterScore;
        diag.avgFps=avgFps; diag.lowFps=lowFps; diag.refreshRate=refreshRate;
        diag.jank32=jank32; diag.jank17=jank17;
        processFinalReport();
    });
}

/* ── 全30項目の診断結果反映 ── */
function processFinalReport() {
    const {avgFps,lowFps,refreshRate,memResult,gpu,battery,storage,networkMbps}=diag;
    document.getElementById('b-fps-avg').textContent=avgFps+' FPS';
    document.getElementById('b-fps-low').textContent=lowFps+' FPS';

    const _v = tv(); // 現在言語の診断値文字列

    // 1. CPUコア数
    const cores=navigator.hardwareConcurrency||2;
    setRow(1,cores+' Cores',st(cores>=12,cores>=6));

    // 2. システムメモリ（高精度推定）
    const ramGB=memResult.gb;
    setRow(2,memResult.label,st(ramGB>=8,ramGB>=4));

    // 3. GPU レンダラー
    const rend=gpu.renderer;
    setRow(3,rend,'ok');

    // 4. GPU 最大テクスチャサイズ
    setRow(4,gpu.maxTex?gpu.maxTex+' px':'--',st(gpu.maxTex>=16384,gpu.maxTex>=8192));

    // 5. CPU ベンチスコア
    setRow(5,scores.cpu+' / 100 pts',st(scores.cpu>=75,scores.cpu>=45));

    // 6. GPU 描画スコア
    setRow(6,scores.gpu+' / 100 pts',st(scores.gpu>=75,scores.gpu>=45));

    // 7. メモリ帯域スコア
    setRow(7,scores.mem+' / 100 pts',st(scores.mem>=75,scores.mem>=45));

    // 8. 平均FPS
    setRow(8,avgFps+' FPS',st(avgFps>=60,avgFps>=30));

    // 9. 1% LOW FPS
    setRow(9,lowFps+' FPS',st(lowFps>=55,lowFps>=30));

    // 10. リフレッシュレート推定
    setRow(10,refreshRate+' Hz',st(refreshRate>=120,refreshRate>=60));

    // 11. 物理解像度
    const physW=Math.round(screen.width*devicePixelRatio);
    const physH=Math.round(screen.height*devicePixelRatio);
    setRow(11,physW+' × '+physH+' px','ok');

    // 12. DPR
    const dpr=window.devicePixelRatio;
    setRow(12,dpr+'x','ok');

    // 13. カラー深度 / HDR
    const depth=screen.colorDepth;
    const hdr=window.matchMedia('(dynamic-range: high)').matches;
    setRow(13,depth+'bit / HDR:'+(hdr?_v.supported:_v.unsupported),st(hdr&&depth>=30,depth>=24));

    // 14. JS ヒープ上限
    const heapMB=window.performance?.memory?Math.round(performance.memory.jsHeapSizeLimit/1048576):null;
    setRow(14,heapMB?heapMB+' MB':_v.unsupported+' (Firefox)',heapMB?st(heapMB>=4096,heapMB>=2048):'warn');

    // 15. UIスレッドレイテンシ
    const lat = diag.latency;
    if(lat){
        const medMs = lat.medMs;
        setRow(15, `Median ${medMs} ms / P95: ${lat.p95Ms} ms`, st(medMs<=17, medMs<=35));
    } else {
        setRow(15,_v.measuring,'warn');
    }

    // 16. ネットワーク実測
    if(networkMbps!==null){
        setRow(16,formatSpeed(networkMbps),st(networkMbps>=100,networkMbps>=20));
    } else {
        setRow(16,_v.failed,'warn');
    }

    // 17. 回線種別 / API 帯域
    const effType=navigator.connection?.effectiveType?.toUpperCase()??'--';
    const dlAPI=navigator.connection?.downlink??null;
    setRow(17,effType+(dlAPI!==null?' / '+formatSpeed(dlAPI):''),st(effType==='4G',effType==='3G'));

    // 18. バッテリー
    if(battery){
        const fmtMin = sec => {
            const m = Math.round(sec / 60);
            if (m >= 60) { const h = Math.floor(m/60); return h+'h'+(m%60 ? m%60+'m' : ''); }
            return m+'m';
        };
        const btime=battery.charging
            ?(battery.chargingTime===Infinity?(battery.level>=99?'':'' ):('→'+fmtMin(battery.chargingTime)))
            :(battery.dischargingTime===Infinity?'':('~'+fmtMin(battery.dischargingTime)));
        const timeStr = btime ? '  '+btime : '';
        setRow(18,battery.level+'%  '+(battery.charging?_v.charging:_v.discharging)+timeStr,
            st(battery.level>=80,battery.level>=30));
    } else {
        setRow(18,'API: '+_v.unsupported,'warn');
    }

    // 19. タッチポイント数
    const tp=navigator.maxTouchPoints;
    setRow(19,tp+' pt',st(tp>=10,tp>=5));

    // 20. ダークモード / ハイコントラスト（非表示）
    const dark=window.matchMedia('(prefers-color-scheme: dark)').matches;
    const hiCon=window.matchMedia('(prefers-contrast: high)').matches;
    document.getElementById('row-20').style.display='none';

    // 21. HTTPS
    const https=location.protocol==='https:';
    setRow(21,https?_v.secure:_v.insecure,https?'ok':'bad');

    // 22. Cookie / IndexedDB
    let idb=false; try{idb=!!window.indexedDB;}catch(e){}
    setRow(22,'Cookie:'+(navigator.cookieEnabled?_v.enabled:_v.disabled)+' / IDB:'+(idb?_v.supported:_v.unsupported),
        st(navigator.cookieEnabled&&idb,navigator.cookieEnabled));

    // 23. WebGL バージョン
    setRow(23,gpu.version,st(gpu.version==='WebGL 2.0',gpu.version==='WebGL 1.0'));

    // 24. WebGL 最大頂点属性数
    setRow(24,gpu.maxAttrib?gpu.maxAttrib+' attrs':'--',st(gpu.maxAttrib>=16,gpu.maxAttrib>=8));

    // 25. WakeLock / 振動
    const wl='wakeLock' in navigator, vib='vibrate' in navigator;
    setRow(25,'WakeLock:'+(wl?_v.supported:_v.unsupported)+' / Vib:'+(vib?_v.supported:_v.unsupported),st(wl&&vib,wl||vib));

    // 26. PWA / SW
    const sw='serviceWorker' in navigator;
    const pwa=window.matchMedia('(display-mode: standalone)').matches;
    setRow(26,'SW:'+(sw?_v.supported:_v.unsupported)+' / PWA:'+(pwa?_v.running:_v.browser),sw?'ok':'warn');

    // 27. WebDriver
    setRow(27,navigator.webdriver?_v.detected:_v.normal,!navigator.webdriver?'ok':'bad');

    // 28. FPS ジッタースコア
    setRow(28,scores.fps+' / 100 pts',st(scores.fps>=75,scores.fps>=50));

    // 29. 言語 / タイムゾーン
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    setRow(29,navigator.language.toUpperCase()+' / '+tz,'good');

    // 32. ダークモード / ハイコントラスト（緑・情報）
    setRow(32,(dark?_v.dark:_v.light)+' / '+(hiCon?_v.hiconOn:_v.hiconOff),'good');

    // 33. 使用ブラウザ（緑・情報）
    setRow(33, detectBrowser(), 'good');

    // 34. デバイス名（緑・情報）
    diag.deviceName = detectDeviceName();
    setRow(34, diag.deviceName, 'good');

    // 30. 診断エンジン
    setRow(30,'Pro Ultra Beta 1.6.93','good');

    // 31. IPアドレス（WebRTC取得 or 外部API）
    const ipEl31 = document.getElementById('v-31');
    const row31  = document.getElementById('row-31');
    if (diag.publicIP) {
        const isPriv = isPrivateIP(diag.publicIP);
        ipEl31.textContent = diag.publicIP + (isPriv ? ' (local)' : '');
        row31.className = 'spec-row st-good';
        row31.style.display = '';
    } else {
        row31.style.display = 'none';
    }

    initHelpIcons();


    // ── スコアリング（CPU32/GPU23/MEM帯域10/FPS15/RAM12/NET8） ──
    const ramScore=Math.min(100,Math.round((ramGB/64)*100));
    const netScore=networkMbps!==null?Math.min(100,Math.round(networkMbps)):50;
    const totalScore=Math.round(
        scores.cpu*0.32+scores.gpu*0.23+scores.mem*0.10+
        scores.fps*0.15+ramScore*0.12+netScore*0.08
    );

    let rank='D';
    if     (totalScore>=80&&lowFps>=55&&scores.cpu>=78&&ramGB>=12) rank='S';
    else if(totalScore>=65&&lowFps>=45&&ramGB>=8)                   rank='A';
    else if(totalScore>=48&&lowFps>=25)                             rank='B';
    else if(totalScore>=30)                                         rank='C';

    // ── デバイス別ランク上限制限 ──────────────────────────────
    const _ua      = navigator.userAgent;
    const _gpu     = (diag.gpu?.renderer || '').toLowerCase();
    const _devName = (diag.deviceName   || '').toLowerCase();

    // ── PC系デバイスの除外（最優先）──
    // UA・デバイス名のいずれかにPC系キーワードがあれば絶対に旧iPhone判定をしない
    const _isPC = /windows|cros|chromebook|macintosh|linux(?!.*android)/i.test(_ua)
               || /windows|chromebook|mac|linux/i.test(_devName);

    // ── iPhone X以下の判定（UA・デバイス名・GPU・解像度の4手法全確認）──
    // 必ずUAに"iPhone"が含まれ、かつPC系でないことを大前提にする
    const _isIPhone = !_isPC && /iphone/i.test(_ua) && !/ipad/i.test(_ua);

    if (_isIPhone) {
        // 手法1: GPU文字列（A11=iPhone8/X, A10以下=それ以前）
        // iPhone X も A11 なので A11以下を対象にする
        const _oldGPU = /apple a([1-9]|1[01])(\s|$)/.test(_gpu);

        // 手法2: 物理解像度
        // iPhone X = 2436×1125, iPhone 8 = 1334×750
        // iPhone X以下は物理長辺が2436px以下
        const _physLong = Math.round(Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1));
        const _oldScreen = _physLong <= 2436;

        // 手法3: UAのiPhone機種番号（iPhone10,3=iPhoneX, iPhone10,6=iPhoneX）
        // iPhone11以降はiPhone12,x以上
        const _modelMatch = _ua.match(/iPhone(\d+),/);
        const _oldModel   = _modelMatch ? parseInt(_modelMatch[1]) <= 10 : false;

        // 3手法のうち2つ以上一致で旧機種と判定（誤判定防止）
        const _oldCount = [_oldGPU, _oldScreen, _oldModel].filter(Boolean).length;
        const _isOldIPhone = _oldCount >= 2;

        if (_isOldIPhone) {
            // iPhone X以下: S・A を B に降格
            if (rank === 'S') rank = 'B';
            if (rank === 'A') rank = 'B';
            // iPhone X以下でRAM 8GB以下（実質全iPhone X以下）はBも出ない
            if (ramGB <= 8) {
                if (rank === 'B') rank = 'C';
            }
        }
    }



    // ── 追加制限① Android Snapdragon 8 Gen 1未満はSランク除外 ──
    const _isAndroid = /android/i.test(_ua);
    if (_isAndroid && rank === 'S') {
        // GPU文字列でSnapdragon 8 Gen 1以上を確認
        // 8 Gen 1 = Adreno 730, 8 Gen 2 = Adreno 740, 8 Gen 3 = Adreno 750
        // Dimensity 9000以上も同等とみなす
        const _isHighEnd = /adreno 7[3-9]\d|adreno [89]\d\d|dimensity 9[0-9]\d\d/i.test(_gpu)
                        || /snapdragon 8 gen [1-9]/i.test(_ua + _devName);
        if (!_isHighEnd) rank = 'A';
    }

    // ── 追加制限② バッテリー節約モードONで1ランク下げる ──
    const _batterySaver = navigator.connection?.saveData === true;
    if (_batterySaver) {
        if      (rank === 'S') rank = 'A';
        else if (rank === 'A') rank = 'B';
        else if (rank === 'B') rank = 'C';
        else if (rank === 'C') rank = 'D';
        // Dはそのまま
    }

    // ── 追加制限③ avgFps 100未満はSランク除外（最新ハイエンドではない）──
    if (avgFps < 100 && rank === 'S') rank = 'A';

    // ── 追加制限④ フラグメントシェーダーの高精度浮動小数点精度が低い場合S・A除外 ──
    // gl.HIGH_FLOAT の precision が 23未満 = GPU演算精度が低い旧世代チップ
    let _shaderPrec = 23; // デフォルトは合格値
    try {
        const _glc = document.createElement('canvas');
        const _gl  = _glc.getContext('webgl') || _glc.getContext('experimental-webgl');
        if (_gl) {
            const _fmt = _gl.getShaderPrecisionFormat(_gl.FRAGMENT_SHADER, _gl.HIGH_FLOAT);
            if (_fmt) _shaderPrec = _fmt.precision;
        }
    } catch(e) {}
    if (_shaderPrec < 23) {
        if (rank === 'S') rank = 'B';
        if (rank === 'A') rank = 'B';
    }

    // ── 追加制限⑤ OffscreenCanvas非対応はSランク除外 ──
    // iOS 16未満・旧ブラウザはOffscreenCanvas未対応 → モダン並列処理不可
    if (typeof OffscreenCanvas === 'undefined') {
        if (rank === 'S') rank = 'A';
    }

    // ── 追加制限⑥（旧⑤） maxTouchPoints 5未満はS・A除外 ──
    if (navigator.maxTouchPoints < 5) {
        if (rank === 'S') rank = 'B';
        if (rank === 'A') rank = 'B';
    }

    // ── 追加制限⑦ userAgentData によるアーキテクチャ精密判定 ──
    // arm(32bit) → C以下 / x86低電圧版 → B以下
    // 非同期だが診断完了後に補正する（取得できた場合のみ適用）
    if (navigator.userAgentData?.getHighEntropyValues) {
        navigator.userAgentData.getHighEntropyValues(
            ['architecture', 'bitness', 'model', 'platformVersion']
        ).then(uaData => {
            const arch    = (uaData.architecture || '').toLowerCase();
            const bitness = uaData.bitness || '';
            // arm 32bit → 旧世代SoC → 最高C
            if (arch === 'arm' && bitness === '32') {
                let r = document.getElementById('rank-letter').textContent;
                if (r === 'S' || r === 'A' || r === 'B') {
                    // FPSが低ければD、そうでなければC
                    const newR = (diag.lowFps < 20) ? 'D' : 'C';
                    document.getElementById('rank-letter').textContent = newR;
                    document.getElementById('rank-letter').className   = 'rank-' + newR;
                }
            }
            // x86 低電圧版（Celeron/Pentium/Atom系）→ 最高B
            // platformVersionが低くモデル名に低電圧系キーワード
            const model = (uaData.model || '').toLowerCase();
            if (arch === 'x86' && /celeron|pentium|atom|n[2-6]\d\d\d|j[1-4]\d\d\d/.test(model)) {
                let r = document.getElementById('rank-letter').textContent;
                if (r === 'S' || r === 'A') {
                    document.getElementById('rank-letter').textContent = 'B';
                    document.getElementById('rank-letter').className   = 'rank-B';
                }
            }
        }).catch(() => {});
    }

    // ── 追加制限⑧ WebGL2非対応 or EXT_color_buffer_float非対応はS→B / A→C ──
    try {
        const _gl2c = document.createElement('canvas');
        const _gl2  = _gl2c.getContext('webgl2');
        const _wgl2ok = _gl2 && _gl2.getExtension('EXT_color_buffer_float');
        if (!_wgl2ok) {
            if (rank === 'S') rank = 'B';
            if (rank === 'A') rank = 'C';
        }
    } catch(e) {}

    // ── 追加制限⑨ iOS 16以前はS・A絶対禁止 ──
    // iOS 17以降にアップデートできない機種（iPhone X/8以前）を排除
    if (_isIPhone) {
        // UAから "iPhone OS 16_" 以前を検出
        const _iosMatch = _ua.match(/iPhone OS (\d+)_/);
        if (_iosMatch && parseInt(_iosMatch[1]) <= 16) {
            if (rank === 'S') rank = 'B';
            if (rank === 'A') rank = 'B';
        }
    }

    // ── 追加制限⑩ Intel Mac（M1以前）はSランク除外 ──
    const _isMac = /macintosh/i.test(_ua);
    if (_isMac) {
        const _hasAppleM = /apple m\d/i.test(_gpu);
        if (!_hasAppleM && rank === 'S') rank = 'A';
    }

    // ── 追加制限⑪ バッテリー残量20%以下かつ非充電でランク1段階ダウン ──
    if (diag.battery && diag.battery.level < 20 && !diag.battery.charging) {
        if      (rank === 'S') rank = 'A';
        else if (rank === 'A') rank = 'B';
        else if (rank === 'B') rank = 'C';
        else if (rank === 'C') rank = 'D';
    }

    // ── 追加制限⑫ Safari低電力モード検出で2段階ダウン ──
    if (diag.safariThrottled) {
        const _dropTwo = { 'S':'C', 'A':'C', 'B':'C', 'C':'D', 'D':'D' };
        rank = _dropTwo[rank] || rank;
    }

    // ── 追加制限：Jank足切り ──
    const _j32 = diag.jank32 || 0;
    const _j17 = diag.jank17 || 0;
    if (_j32 >= 1 && rank === 'S') rank = 'A';
    if (_j17 >= 5 && rank === 'A') rank = 'B';

    // ── 追加制限：Safari低電力モード検知（rAFタイマー間引き検出）──
    const _isSafari = /safari/i.test(_ua) && !/chrome|crios|fxios/i.test(_ua);
    if (_isSafari) {
        // ジッタースコアが低い = タイマーが間引かれている可能性
        const _timerThrottled = scores.fps <= 40;
        if (_timerThrottled) {
            if      (rank === 'S') rank = 'C';
            else if (rank === 'A') rank = 'C';
            else if (rank === 'C') rank = 'D';
            // B はそのまま
        }
    }

    // ── 特別昇格：200FPS超えは他条件を無視してS ──
    if (avgFps >= 200) rank = 'S';

    const rEl=document.getElementById('rank-letter');
    rEl.textContent=rank; rEl.className='rank-'+rank;

    const _diagLang = _getLang();
    const _ui2 = tui();
    document.getElementById('status-title').textContent = _diagLang.rankMsgs[rank] || rank;
    document.getElementById('eval-msg').textContent =
        `${_ui2.scoreLabel} ${totalScore}/100\nCPU:${scores.cpu}  GPU:${scores.gpu}  RAM:${ramGB}GB  ${_ui2.memLabel}:${scores.mem}  ${_ui2.fpsLabel}:${scores.fps}  ${_ui2.netLabel}:${networkMbps!=null?formatSpeed(networkMbps):'?'}`;
    document.getElementById('ai-btn').style.display='block';
    document.getElementById('save-btn').style.display='block';
    document.getElementById('share-hint').style.display='block';
    document.getElementById('history-btn').style.display='block';
    document.getElementById('speed-btn').style.display='block';
    document.getElementById('battle-btn').style.display='block';
    document.getElementById('retry-btn').style.display='block';

    // 診断完了トースト
    const doneToast = document.createElement('div');
    doneToast.textContent = tui().diagComplete;
    doneToast.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1c1c1e;color:#fff;padding:14px 28px;border-radius:40px;font-size:0.95rem;font-weight:700;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid #3a3a3c;z-index:999999;opacity:0;transition:opacity 0.3s;white-space:nowrap;';
    document.body.appendChild(doneToast);
    requestAnimationFrame(() => { doneToast.style.opacity = '1'; });
    setTimeout(() => {
        doneToast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(doneToast), 300);
    }, 2500);

    // ローカルストレージに結果を保存
    saveResultToHistory(totalScore, rank, scores, ramGB, diag.avgFps, diag.lowFps, diag.networkMbps);

    // 設定に応じたフィードバック
    // 完了音を先に鳴らす→通知はわずかに遅らせて干渉を防ぐ
    playDoneSound();
    vibrateOnDone();
    setTimeout(() => { notifyOnDone(rank, totalScore); }, 800);
    setBadge();

    // URLパラメータから対戦相手がいれば自動表示
    if (window._pendingBattleOpponent) {
        setTimeout(() => {
            showBattleResult(_getBattleData(), window._pendingBattleOpponent, 'URL');
            window._pendingBattleOpponent = null;
        }, 1000);
    }
}

/* ── キャプチャ ── */
// ── 警告フロー共通変数 ──────────────────────────────────────────
// _action: 'save'=保存, 'share'=シェア
let _ipMode  = 'show';
let _devMode = 'show';
let _action  = 'save';

// ── 保存ボタン ──────────────────────────────────────────────────
function triggerReportCapture() {
    const fmt = _settings.exportFormat || 'png';
    if (fmt === 'csv') { downloadCSV(); return; }
    if (fmt === 'pdf') { downloadPDF(); return; }
    // PNG: 通常のキャプチャフロー
    _action = 'save';
    _ipMode = 'show';
    _devMode = 'show';
    if (diag.publicIP) {
        document.getElementById('ip-warn-overlay').style.display = 'flex';
    } else {
        showDeviceWarn();
    }
}

function downloadCSV() {
    const rows = [];
    const labels = I18N_LABELS[_settings.language] || I18N_LABELS['ja'];
    rows.push(['"項目"', '"値"']);
    for (let i = 1; i <= 34; i++) {
        const el = document.getElementById('v-' + i);
        if (!el) continue;
        const val = el.textContent.trim();
        if (!val || val === '--') continue;
        const label = labels[i - 1] || ('Row ' + i);
        rows.push(['"' + label.replace(/"/g, '""') + '"', '"' + val.replace(/"/g, '""') + '"']);
    }
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'device-diagnostic-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function downloadPDF() {
    const btn = document.getElementById('save-btn');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ PDF生成中...';

    // jsPDFを動的ロード
    if (!window.jspdf) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
        }).catch(() => null);
    }

    const area = document.getElementById('capture-area');
    area.classList.add('capture-mode');
    window.scrollTo({ top: 0, behavior: 'instant' });
    await wait(150);

    try {
        const canvas = await html2canvas(area, {
            backgroundColor: '#050505', scale: 2,
            useCORS: true, logging: false, scrollX: 0, scrollY: 0
        });
        area.classList.remove('capture-mode');

        const imgData = canvas.toDataURL('image/png', 1.0);
        const imgW = canvas.width;
        const imgH = canvas.height;

        // A4サイズ（mm）に合わせてスケール
        const { jsPDF } = window.jspdf;
        const pdfW  = 210; // A4幅mm
        const pdfH  = Math.round((imgH / imgW) * pdfW);
        const pdf   = new jsPDF({ orientation: pdfH > pdfW ? 'p' : 'l', unit: 'mm', format: [pdfW, pdfH] });
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
        pdf.save('device-report-' + new Date().toISOString().slice(0, 10) + '.pdf');

    } catch(err) {
        area.classList.remove('capture-mode');
        alert('PDF生成に失敗しました。\n' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

// ── シェアボタン ────────────────────────────────────────────────
async function shareToX() {
    // シェアフロー：保存と全く同じキャプチャフローを経由する
    // capturedDataUrl がすでにあれば生成スキップ、なければ保存と同じフローで生成
    _action  = 'share';
    _ipMode  = 'show';
    _devMode = 'show';
    if (diag.publicIP) {
        document.getElementById('ip-warn-overlay').style.display = 'flex';
    } else {
        showDeviceWarn();
    }
}


// ── IP警告：選択 ────────────────────────────────────────────────
function ipChosen(mode) {
    _ipMode = mode;
    document.getElementById('ip-warn-overlay').style.display = 'none';
    showDeviceWarn();
}

// ── デバイス名警告：表示 ────────────────────────────────────────
function showDeviceWarn() {
    const name = diag.deviceName || '不明';
    document.getElementById('device-warn-msg').textContent =
        '「' + name + '」というデバイス機種が含まれています。SNSに公開しても問題ないですが、見られたら不快なのであれば隠すことをおすすめします。';
    document.getElementById('device-warn-overlay').style.display = 'flex';
}

// ── デバイス名警告：選択 ────────────────────────────────────────
function deviceChosen(mode) {
    _devMode = mode;
    document.getElementById('device-warn-overlay').style.display = 'none';
    if (_action === 'share') {
        // Web Share API チェック
        if (typeof navigator.share !== 'function') {
            alert('このブラウザまたは機種では対応していないため、画像を先に保存してからXに投稿してください。');
            return;
        }
        doShare(_ipMode, _devMode);
    } else {
        proceedCapture(_ipMode, _devMode);
    }
}

// ── 戻るボタン ──────────────────────────────────────────────────
function goBackToIP() {
    document.getElementById('device-warn-overlay').style.display = 'none';
    if (diag.publicIP) {
        document.getElementById('ip-warn-overlay').style.display = 'flex';
    }
    // IPなし環境では戻る先がないのでキャンセル扱い
}

// ── シェア実行 ──────────────────────────────────────────────────
async function doShare(ipMode, devMode) {
    const text  = '#デバイス診断 #PreciseDiag #ProUltra #診断結果';
    const ipEl  = document.getElementById('v-31');
    const devEl = document.getElementById('v-34');
    const origIP  = ipEl  ? ipEl.textContent  : '';
    const origDev = devEl ? devEl.textContent : '';

    // IP・デバイス名を選択に応じて書き換え
    if (ipMode === 'hide' && ipEl) {
        ipEl.textContent = '非表示';
    } else if (ipMode === 'mask' && ipEl) {
        ipEl.textContent = maskIPAddress(origIP);
    }
    if (devMode === 'hide' && devEl) {
        const nl = devEl.textContent.length;
        devEl.textContent = '*'.repeat(nl >= 10 ? Math.floor(nl / 2) : nl);
    }

    // proceedCaptureと同じ確実なキャプチャフロー
    const btn = document.getElementById('share-x-btn');
    btn.disabled = true;
    btn.innerHTML = '画像を生成中...';
    window.scrollTo({ top: 0, behavior: 'instant' });
    await wait(150);

    const area = document.getElementById('capture-area');
    area.classList.add('capture-mode');
    await wait(80);

    let shareUrl = null;
    try {
        const canvas = await html2canvas(area, {
            backgroundColor: '#050505', scale: 2,
            useCORS: true, logging: false, scrollX: 0, scrollY: 0
        });
        area.classList.remove('capture-mode');
        shareUrl = canvas.toDataURL('image/png', 1.0);
        capturedDataUrl = shareUrl; // 保存ボタン用にも保持
    } catch(e) {
        area.classList.remove('capture-mode');
        if (ipEl)  ipEl.textContent  = origIP;
        if (devEl) devEl.textContent = origDev;
        btn.disabled = false;
        btn.innerHTML = SHARE_SVG;
        alert('画像の生成に失敗しました: ' + e.message);
        return;
    }

    // 表示を元に戻す
    if (ipEl)  ipEl.textContent  = origIP;
    if (devEl) devEl.textContent = origDev;
    btn.disabled = false;
    btn.innerHTML = SHARE_SVG;

    // シェア実行
    try {
        const res  = await fetch(shareUrl);
        const blob = await res.blob();
        const file = new File([blob], 'device-diagnostic.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text });
        } else {
            await navigator.share({ text });
            alert('このブラウザまたは機種では対応していないため、画像を先に保存してからXに投稿してください。');
        }
    } catch(e) {
        if (e.name === 'AbortError') return;
        alert('このブラウザまたは機種では対応していないため、画像を先に保存してからXに投稿してください。');
    }
}


// IP マスク共通関数（Qバグ根絶版）
function maskIPAddress(ipText) {
    // 数字と.だけ抜き出してIPv4を再構成
    const digits = ipText.replace(/[^0-9.]/g, '').split('.');
    if (digits.length < 4) return ipText; // IPv4でない場合はそのまま

    // 後ろ付記（"(ローカル)"等）を保持
    const afterIP = ipText.replace(/^[\d.]+/, '').trim();
    const suffix  = afterIP ? ' ' + afterIP : '';

    const parts = [digits[0], digits[1], digits[2], digits[3]];
    // 末尾オクテットは必ず全隠し
    parts[3] = '*'.repeat(parts[3].length || 2);
    // 残り0〜2からランダムで1つ選び、そのオクテットも全隠し
    const mi = Math.floor(Math.random() * 3);
    if (parts[mi]) parts[mi] = '*'.repeat(parts[mi].length || 2);
    return parts.join('.') + suffix;
}

function closeModal() { document.getElementById('modal-overlay').style.display='none'; }

// ── AIチャット ──────────────────────────────────────────────────
const _aiHistory = [];

// ── AI会話履歴の保存・管理（最大5件） ──────────────────────────
const AI_STORAGE_KEY = 'ai_conversations';

function loadAIConvs() {
    try { return JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || '[]'); } catch(e) { return []; }
}
function saveAIConvs(convs) {
    try {
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(convs));
        syncAIConvsToCloud(convs);
    } catch(e) {}
}

function saveCurrentConv(name) {
    if (_aiHistory.filter(m => m.role).length === 0) return;
    const convs = loadAIConvs();
    const entry = {
        id:       Date.now(),
        name:     name || '会話 ' + new Date().toLocaleString('ja-JP'),
        date:     new Date().toLocaleString('ja-JP'),
        messages: _aiHistory.filter(m => m.role).slice(),
        sys:      _aiHistory._sys || ''
    };
    convs.unshift(entry);
    if (convs.length > 5) convs.splice(5);
    saveAIConvs(convs);
}

function showAIConvManager() {
    const convs = loadAIConvs();
    const modal = document.getElementById('ai-conv-modal');
    const list  = document.getElementById('ai-conv-list');

    if (convs.length === 0) {
        list.innerHTML = '<p style="color:var(--sub-text);text-align:center;padding:20px;">保存された会話がありません。</p>';
    } else {
        list.innerHTML = convs.map((cv, i) => `
            <div data-conv-idx="${i}" style="background:#1a1a1a;border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;">
                <div class="ai-conv-name-area">
                    <div style="font-weight:800;color:#a78bfa;">💬 ${cv.name}</div>
                </div>
                <div style="color:var(--sub-text);font-size:0.8rem;margin:4px 0 10px;">${cv.date} · ${cv.messages.length}メッセージ</div>
                <div style="display:flex;gap:8px;">
                    <button data-conv-action="load"   data-conv-i="${i}" style="flex:1;padding:8px;border-radius:10px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:#a78bfa;font-size:0.82rem;font-weight:700;cursor:pointer;">📂 読み込む</button>
                    <button data-conv-action="rename" data-conv-i="${i}" style="flex:1;padding:8px;border-radius:10px;background:rgba(0,122,255,0.15);border:1px solid rgba(0,122,255,0.3);color:#6bb5ff;font-size:0.82rem;font-weight:700;cursor:pointer;">✏️ 名前変更</button>
                    <button data-conv-action="delete" data-conv-i="${i}" style="flex:1;padding:8px;border-radius:10px;background:rgba(255,59,48,0.15);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;font-size:0.82rem;font-weight:700;cursor:pointer;">🗑 削除</button>
                </div>
            </div>`).join('');
    }

    list.onclick = (e) => {
        const btn = e.target.closest('button[data-conv-action]');
        if (!btn) return;
        const i   = parseInt(btn.dataset.convI);
        const act = btn.dataset.convAction;
        const convs2 = loadAIConvs();
        if (act === 'load') {
            _aiHistory.length = 0;
            _aiHistory._sys = convs2[i].sys;
            convs2[i].messages.forEach(m => _aiHistory.push(m));
            const msgs = document.getElementById('ai-messages');
            msgs.innerHTML = '';
            _aiHistory.filter(m => m.role).forEach(m => appendAIMsg(m.role, m.content));
            document.getElementById('ai-conv-modal').style.display = 'none';
            document.getElementById('ai-modal').style.display = 'flex';
        } else if (act === 'delete') {
            convs2.splice(i, 1);
            saveAIConvs(convs2);
            showAIConvManager();
        } else if (act === 'rename') {
            const card = e.target.closest('[data-conv-idx]');
            const nameArea = card?.querySelector('.ai-conv-name-area');
            if (!nameArea) return;
            const cur = convs2[i].name;
            nameArea.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:4px;">
                    <input id="ai-conv-rename-${i}" type="text" value="${cur.replace(/"/g,'&quot;')}"
                        style="flex:1;background:#2a2a2a;border:1px solid var(--accent);border-radius:8px;padding:6px 10px;color:#fff;font-size:0.88rem;outline:none;">
                    <button data-conv-action="rename-save" data-conv-i="${i}"
                        style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;cursor:pointer;font-size:0.82rem;">保存</button>
                </div>`;
            document.getElementById(`ai-conv-rename-${i}`)?.focus();
        } else if (act === 'rename-save') {
            const val = document.getElementById(`ai-conv-rename-${i}`)?.value.trim() || '';
            if (val) { convs2[i].name = val; saveAIConvs(convs2); }
            showAIConvManager();
        }
    };
    modal.style.display = 'flex';
}

function openAIChat() {
    _aiHistory.length = 0;
    document.getElementById('ai-messages').innerHTML = '';
    const rank  = document.getElementById('rank-letter').textContent;
    const score = document.getElementById('eval-msg').textContent;
    const dev   = document.getElementById('v-34')?.textContent || '不明';
    const ram   = document.getElementById('v-2')?.textContent  || '不明';
    const fps   = document.getElementById('v-8')?.textContent  || '不明';
    const lFps  = document.getElementById('v-9')?.textContent  || '不明';
    const cpu   = document.getElementById('v-5')?.textContent  || '不明';
    const gpu   = document.getElementById('v-6')?.textContent  || '不明';
    _aiHistory._sys = `あなたは「精密デバイス診断 Pro Ultra」の公式AIアシスタントです。以下の診断データとアプリ仕様を完全に記憶して正確に回答してください。

■ ユーザーの診断結果
ランク: ${rank}（S=最高峰 / A=高性能 / B=標準 / C=やや非力 / D=旧式）
スコア: ${score}（CPU32% GPU23% FPS15% RAM12% メモリ帯域10% NET8% の加重合計）
デバイス: ${dev} / RAM: ${ram} / avgFPS: ${fps} / 1%LOW: ${lFps}（カクつきの激しさ）/ CPU: ${cpu}/100 / GPU: ${gpu}/100

■ アプリの全機能仕様

【診断機能】
・ページを開くと自動診断開始。CPU/GPU/メモリ帯域/FPS/RAM/ネットワーク/バッテリー等30以上の項目を計測
・FPS計測は15秒間。オフスクリーンCanvasに120個のパーティクルで実負荷をかけて精度向上
・診断中は残り時間を1秒ごとに表示。完了時に「✅ 処理が完了しました」トーストが出る
・色の意味：青=正常 / 黄=注意 / 赤=警告 / 緑=情報

【画像保存機能（青いボタン「診断レポートを画像で保存する」）】
・2段階のプライバシー警告がある
・第1段階：IPアドレスの扱いを3択で選ぶ
  ①「🔒 IPアドレスを非表示にして保存（推奨）」→ 完全に「非表示」という文字に置き換わる
  ②「⚠️ 一部を*で隠して保存」→ 末尾オクテット等を*でマスク
  ③「そのまま含めて保存」→ IPがそのまま画像に入る
  ・「← 戻る（保存をキャンセル）」で保存自体をキャンセル可能
・第2段階：デバイス名の扱いを2択で選ぶ
  ①「そのまま含めて保存」（緑ボタン・上）
  ②「🔒 デバイス名を*に変更して保存」（青ボタン・下）
  ・「← 戻る（IPアドレスの選択に戻る）」で第1段階に戻れる
・2段階完了後に画像が生成されプレビューモーダルが開く

【プレビューモーダルのボタン（3つ）】
①「⬇ 画像をダウンロード」→ PNG画像をデバイスに保存
②「診断に戻る」→ モーダルを閉じる
③「X (Twitter) にシェアする」（白枠・Xロゴ付きボタン）
  → 押すと「①画像が自動ダウンロードされる」「②0.3秒後にXの投稿画面が新しいタブで開く」の2つが自動実行される
  → テキスト「#デバイス診断 #PreciseDiag #ProUltra #診断結果」が自動入力済み
  → ※画像はXに自動添付されない。ダウンロードされた画像を手動で添付する必要がある
  → ボタン下に「※ 画像は自身で添付していただく形です」という注記がある
・保存ボタン下に「💡 プレビュー画面のダウンロードボタン下からXにシェアできます」という案内も表示される
・現在クラウドにアップロード(Google Drive, OneDrive 等)機能は開発中

【履歴機能（ピンクのボタン「📊 過去の診断結果を見る」）】
・診断完了のたびに自動でlocalStorageに最大3回分保存
・各カードに：ランク・スコア・日時・CPU/GPU/RAM/avgFPS/1%LOW/NETを表示
・「✏️ 名前をつける」→ カード内にインライン入力欄が展開されて名前入力（例：「YouTube重い時」）
・「🗑 削除」→ 1件だけ削除してリストを即再描画

【AIアドバイザー（紫のボタン「🤖 AIアドバイザーに相談する」）】
・起動時に診断データを自動読み取り
・上部入力欄に名前を入れて「💾 保存」で会話を最大5件保存可能
・「📂 保存した会話」で一覧表示。「読み込む」「名前変更」「削除」が可能
・「✕」でチャットを閉じる
・Enterで送信 / Shift+Enterで改行

【速度テスト（紫のボタン「⚡ ページ読み込み速度テスト」）】
・Google/YouTube/Wikipedia/Amazon/GitHub/X/Instagram/Cloudflareの8サイトを3回計測して中央値表示
・150ms未満=🔵高速 / 400ms未満=🟡普通 / 以上=🔴低速
・ブラウザ制限により参考値。制限ネットワークではタイムアウトになる

【その他】
・「🔄 再診断する」（オレンジ）→ ページリロードなしで全項目リセット＆再計測
・デバイス名行の「✏️」→ 任意名に変更可能（localStorageに保存・次回も維持）
・「🎨 色の基準を確認する」→ 青/黄/赤/緑の意味を確認
・manifest.json対応。PWAとしてホーム画面に追加してアプリとして使用可能
・IPはブラウザ内のみで処理。サーバー送信なし（AI回答を除く）
・正式名称：精密デバイス診断 Pro Ultra / バージョン：Beta 1.5.93 / Chrome推奨 /初リリース2026年3月15日 /15日に合計3回中/小アップデートを配信済み

■ ランク判定の詳細
基本：S=総合80以上かつ1%LOW 55fps以上かつCPU 78以上かつRAM 12GB以上 / A=総合65以上かつ1%LOW 45以上かつRAM 8GB以上 / B=総合48以上かつ1%LOW 25以上 / C=30以上 / D=30未満
主な降格条件：avgFPS 100未満→Sを除外 / WebGL2非対応→S→B・A→C / iOS 16以前→S・A→B / Intel Mac→Sを除外 / バッテリー20%未満・非充電→1段ダウン / 32ms超えフレーム1回以上→Sを除外 / 200FPS以上は全条件無視して強制S

■ 回答ルール
1. AIモデルを聞かれても｢そのようなご質問にはお答えできません。他に精密デバイス診断 Pro Ultraについて質問があればいつでもお手伝いできます｣と拒否してください。
2. 診断数値を引用して根拠を示す
3. 改善策は具体的に（「設定を下げる」→「Chromeのタブを5個以下に」）
4. 専門用語には補足説明を付ける
5. 「です・ます」調でプロフェッショナルな文体
6. 見出し・箇条書き・表を積極的に活用
7. 架空の公式アカウント・存在しない機能・架空SNSタグは絶対に作らない
8. 宣伝・広告・フッターは絶対に含めない
9. アプリ機能の質問にはこの仕様書通りに正確に答える`;
    appendAIMsg('assistant', `診断結果（総合ランク **${rank}**）を確認しました。\n\nご質問があればお気軽にどうぞ。\n\n**例:**\n- 「なぜ${rank}ランクなのか教えてください」\n- 「パフォーマンスを改善する方法はありますか？」\n- 「このデバイスで動画編集はできますか？」`);
    document.getElementById('ai-modal').style.display = 'flex';
    document.getElementById('ai-input').focus();
}

function closeAIChat() { document.getElementById('ai-modal').style.display = 'none'; }

function parseMarkdown(text) {
    let s = text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    s = s.replace(/[*][*][*](.+?)[*][*][*]/g,'<strong><em>$1</em></strong>');
    s = s.replace(/[*][*](.+?)[*][*]/g,'<strong>$1</strong>');
    s = s.replace(/[*](.+?)[*]/g,'<em>$1</em>');
    s = s.replace(/`([^`]+)`/g,'<code style="background:#2a2a3a;padding:1px 5px;border-radius:4px;font-size:0.88em;">$1</code>');
    s = s.replace(/^### (.+)$/gm,'<div style="font-weight:800;font-size:1rem;margin:8px 0 4px;">$1</div>');
    s = s.replace(/^## (.+)$/gm,'<div style="font-weight:800;font-size:1.05rem;margin:8px 0 4px;">$1</div>');
    s = s.replace(/^# (.+)$/gm,'<div style="font-weight:800;font-size:1.1rem;margin:8px 0 4px;">$1</div>');
    s = s.replace(/^[-*] (.+)$/gm,'<div style="padding-left:12px;">• $1</div>');
    s = s.replace(/\n/g,'<br>');
    return s;
}

function appendAIMsg(role, text) {
    const msgs = document.getElementById('ai-messages');
    const div  = document.createElement('div');
    div.className = 'ai-msg ' + role;
    if (role === 'assistant') {
        div.innerHTML = parseMarkdown(text);
    } else {
        div.textContent = text;
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
}

async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const btn   = document.getElementById('ai-send');
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';
    btn.disabled = true;
    appendAIMsg('user', text);
    _aiHistory.push({ role: 'user', content: text });
    const loading = appendAIMsg('assistant', '');

    // ── タイマー ────────────────────────────────────────────────
    let _timerSec = 18;
    const _timerLabel = document.createElement('div');
    _timerLabel.style.cssText = 'color:#a78bfa;font-size:0.8rem;margin-top:4px;';
    const _statusLabel = document.createElement('div');
    _statusLabel.textContent = '回答を生成しています...';
    loading.appendChild(_statusLabel);
    loading.appendChild(_timerLabel);

    function _updateTimerDisplay() {
        _timerLabel.textContent = '推定残り時間: 約 ' + _timerSec + ' 秒';
    }
    function _resetTimer(sec, statusText) {
        _timerSec = sec;
        if (statusText) _statusLabel.textContent = statusText;
        _updateTimerDisplay();
    }

    _updateTimerDisplay();
    const _tickInterval = setInterval(() => {
        const dec = Math.random() < 0.3 ? 2 : 1;
        _timerSec = Math.max(1, _timerSec - dec);
        // 長引いたら増やす
        if (_timerSec <= 2) _timerSec += Math.floor(Math.random() * 5) + 3;
        _updateTimerDisplay();
    }, 1000);

    // ── メッセージ構築（直近6件に制限） ────────────────────────
    const recent   = _aiHistory.filter(m => m.role).slice(-6);
    const messages = [
        { role: 'system', content: _aiHistory._sys },
        ...recent
    ];

    let reply    = null;
    let lastErr  = '';
    // 各サービスのエラーを蓄積（最終表示用）
    const _errLog = [];  // { service, code, msg } の配列

    // ══════════════════════════════════════════════════════
    // 【1位】Pollinations — openaiモデルのみ・キーなし
    // 失敗したら即2位へ（リトライなし・8秒タイムアウト）
    // ══════════════════════════════════════════════════════
    try {
        _resetTimer(18, '回答を生成しています...');
        const _ctrl = new AbortController();
        const _tout = setTimeout(() => _ctrl.abort(), 12000);
        const resp = await fetch('https://text.pollinations.ai/v1/chat/completions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ model: 'openai', messages, private: true }),
            signal:  _ctrl.signal
        });
        clearTimeout(_tout);
        if (resp.ok) {
            const data = await resp.json();
            const raw  = data.choices?.[0]?.message?.content || '';
            if (raw) {
                let cleaned = raw.replace(/\n---[\s\S]*$/m, '');
                cleaned = cleaned.replace(/Powered by Pollinations[^\n]*/gi, '');
                cleaned = cleaned.replace(/Support our mission[^\n]*/gi, '');
                reply = cleaned.trim() || raw.trim();
            } else {
                lastErr = 'Pollinations: 空のレスポンス';
                _errLog.push({ service: 'Pollinations', code: '空レスポンス', msg: 'AIが空の返答を返しました。サービスが混雑しています。' });
            }
        } else {
            lastErr = 'Pollinations: HTTP ' + resp.status;
            const _codeMap = { 429: 'レート制限（使いすぎ）', 503: 'サーバー過負荷', 500: 'サーバー内部エラー', 401: '認証エラー' };
            _errLog.push({ service: 'Pollinations', code: 'HTTP ' + resp.status, msg: (_codeMap[resp.status] || 'サーバーエラー') + '。OpenRouterに切り替えます。' });
        }
    } catch(e) {
        const _isTimeout = e.name === 'AbortError';
        lastErr = _isTimeout ? 'Pollinations: タイムアウト(8秒)' : 'Pollinations: ' + (e.message || 'ネットワークエラー');
        _errLog.push({ service: 'Pollinations', code: _isTimeout ? 'タイムアウト' : 'ネットワークエラー',
            msg: _isTimeout ? 'Pollinationsが8秒以内に応答しませんでした。OpenRouterに切り替えます。'
                            : 'Pollinationsへの接続に失敗しました。OpenRouterに切り替えます。' });
    }

    // ══════════════════════════════════════════════════════
    // 【2位】OpenRouter — APIキーあり・安定
    // ══════════════════════════════════════════════════════
    if (!reply) {
        _resetTimer(20, '別サービスで再試行中 (OpenRouter)...');
        await new Promise(r => setTimeout(r, 1000));
        // OpenAI系2モデルのみ（無料枠節約）
        const orModels = [
            'openai/gpt-4o-mini',
            'openai/gpt-3.5-turbo'
        ];
        for (const orModel of orModels) {
            try {
                const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': 'Bearer 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',
                        'HTTP-Referer':  'https://sorato-yukkuri.github.io/Pro-Ultra-Sorato02.github.io/',
                        'X-Title':       '精密デバイス診断 Pro Ultra'
                    },
                    body: JSON.stringify({ model: orModel, messages })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const raw  = data.choices?.[0]?.message?.content || '';
                    if (raw) { reply = raw.trim(); break; }
                    lastErr = 'OpenRouter(' + orModel + '): 空のレスポンス';
                    _errLog.push({ service: 'OpenRouter', code: '空レスポンス', msg: 'モデル ' + orModel + ' が空の返答を返しました。' });
                } else {
                    lastErr = 'OpenRouter(' + orModel + '): HTTP ' + resp.status;
                    const _orMap = { 402: '無料クレジット枯渇。OpenRouterの無料枠を使い切りました。', 403: 'APIキーが無効または期限切れ。', 429: 'レート制限。短時間に送りすぎています。', 503: 'OpenRouterサーバーが過負荷状態。' };
                    _errLog.push({ service: 'OpenRouter', code: 'HTTP ' + resp.status, msg: _orMap[resp.status] || 'OpenRouterサーバーエラー (HTTP ' + resp.status + ')。' });
                    if (resp.status === 402 || resp.status === 403) break;
                }
            } catch(e) {
                lastErr = 'OpenRouter: ' + (e.message || 'ネットワークエラー');
                _errLog.push({ service: 'OpenRouter', code: 'ネットワークエラー', msg: 'OpenRouterへの接続に失敗しました。' });
            }
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    // ══════════════════════════════════════════════════════
    // 【3位】Puter.js — ログイン済みなら無制限・キーなし
    // isSignedIn()は仮想環境で誤動作するため使わない
    // → 直接AIを呼んで、認証エラー時にログイン促しUIを表示
    // ══════════════════════════════════════════════════════
    if (!reply) {
        _resetTimer(25, '最終手段で再試行中 (Puter.js)...');
        await new Promise(r => setTimeout(r, 1000));
        try {
            // Puter.js がまだ読み込まれていなければ動的に読み込む
            if (typeof puter === 'undefined') {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://js.puter.com/v2/';
                    s.onload  = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
                await new Promise(r => setTimeout(r, 2000));
            }

            // isSignedIn()チェックなし → 直接AIを呼ぶ
            // 認証エラーが出たらcatchでログイン促しUIを表示
            const res = await puter.ai.chat(messages, { model: 'gpt-4o-mini' });
            const raw = (typeof res === 'string')
                ? res
                : res?.message?.content
               || res?.choices?.[0]?.message?.content
               || res?.content
               || '';
            if (raw) {
                reply = raw.trim();
            } else {
                lastErr = 'Puter.js: 空のレスポンス';
                _errLog.push({ service: 'Puter.js', code: '空レスポンス', msg: 'Puter.jsが空の返答を返しました。再試行してください。' });
            }

        } catch(e) {
            const _isAuthErr = /auth|login|sign|unauthorized|401/i.test(e.message || '');
            if (_isAuthErr) {
                // 認証エラー → ログイン促しUIを表示して終了
                clearInterval(_tickInterval);
                loading.innerHTML = `
                    <div style="background:#1a1a2e;border:1px solid #a78bfa;border-radius:16px;padding:20px;text-align:center;">
                        <div style="font-size:1.6rem;margin-bottom:8px;">⚠️</div>
                        <div style="font-weight:800;font-size:1rem;color:#fff;margin-bottom:6px;">AIの一部にアクセスできませんでした</div>
                        <div style="color:#aaa;font-size:0.85rem;line-height:1.6;margin-bottom:16px;">
                            このAI（Puter.js）を使うには<br>
                            <strong style="color:#a78bfa;">Puter.js のログイン / サインアップ</strong>が必要です。<br>
                            無料で登録できます。
                        </div>
                        <button onclick="window.open('https://puter.com', '_blank', 'noopener')"
                            style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;border:none;font-weight:800;font-size:0.95rem;cursor:pointer;margin-bottom:8px;">
                            🔑 Puter.js にログイン / サインアップ
                        </button>
                        <div style="color:#666;font-size:0.75rem;">登録後、このページを再読み込みして再送信してください</div>
                    </div>`;
                btn.disabled = false;
                document.getElementById('ai-messages').scrollTop = 99999;
                input.focus();
                return;
            }
            // 認証以外のエラー → 通常エラーログに追加
            lastErr = 'Puter.js: ' + (e.message || 'エラー');
            _errLog.push({ service: 'Puter.js', code: 'エラー', msg: e.message || '不明なエラーが発生しました。' });
        }
    }

    clearInterval(_tickInterval);

    if (reply) {
        loading.innerHTML = parseMarkdown(reply);
        _aiHistory.push({ role: 'assistant', content: reply });
    } else {
        // 原因別エラーUIを生成
        const _errRows = _errLog.map(e =>
            `<div style="background:#1a1a1a;border-left:3px solid #ff453a;border-radius:8px;padding:10px 14px;margin-bottom:8px;text-align:left;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-weight:800;color:#fff;font-size:0.88rem;">${e.service}</span>
                    <span style="background:rgba(255,69,58,0.2);color:#ff6b6b;font-size:0.75rem;padding:2px 8px;border-radius:20px;font-weight:700;">${e.code}</span>
                </div>
                <div style="color:#aaa;font-size:0.82rem;line-height:1.5;">${e.msg}</div>
            </div>`
        ).join('');

        loading.innerHTML = `
            <div style="background:#1c0a0a;border:1px solid #ff453a;border-radius:16px;padding:18px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
                    <span style="font-size:1.3rem;">❌</span>
                    <span style="font-weight:800;font-size:1rem;color:#fff;">すべてのAIサービスに接続できませんでした</span>
                </div>
                <div style="margin-bottom:14px;">${_errRows || '<div style="color:#aaa;font-size:0.85rem;">エラー詳細を取得できませんでした。</div>'}</div>
                <div style="background:#111;border-radius:10px;padding:12px;font-size:0.82rem;color:#888;line-height:1.7;">
                    💡 <strong style="color:#ccc;">対処法</strong><br>
                    ① しばらく待ってから再送信<br>
                    ② ページをリロードして再診断<br>
                    ③ 別のWi-Fi / 回線に切り替える<br>
                    ④ Puter.jsにログインすると接続が安定します
                </div>
            </div>`;
    }
    btn.disabled = false;
    document.getElementById('ai-messages').scrollTop = 99999;
    input.focus();
}


async function modalShareToX() {
    if (!capturedDataUrl) return;

    // ① まずダウンロード
    const a = document.createElement('a');
    a.href = capturedDataUrl;
    a.download = 'device-diagnostic-' + new Date().toISOString().slice(0,10) + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);

    // ② 少し待ってからXシェア画面へ
    await wait(300);
    const text = encodeURIComponent('#デバイス診断 #PreciseDiag #ProUltra #診断結果');
    window.open('https://twitter.com/intent/tweet?text=' + text, '_blank', 'noopener');
}

async function proceedCapture(mode, devMode) {
    const ipEl  = document.getElementById('v-31');
    const devEl = document.getElementById('v-34');
    const originalIP  = ipEl  ? ipEl.textContent  : '';
    const originalDev = devEl ? devEl.textContent : '';

    // IP表示の書き換え
    if (mode === 'hide' && ipEl) {
        ipEl.textContent = '非表示';
    } else if (mode === 'mask' && ipEl) {
        ipEl.textContent = maskIPAddress(originalIP);
    }

    // デバイス名の書き換え
    if (devMode === 'hide' && devEl) {
        const nl = devEl.textContent.length;
        devEl.textContent = '*'.repeat(nl >= 10 ? Math.floor(nl / 2) : nl);
    }

    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.textContent = '⏳ ' + (_getLang().generatingLabel || '生成中...');
    window.scrollTo({ top: 0, behavior: 'instant' });
    await wait(150);

    const area = document.getElementById('capture-area');
    area.classList.add('capture-mode');
    await wait(80);

    try {
        const canvas = await html2canvas(area, {
            backgroundColor: '#050505', scale: 2,
            useCORS: true, logging: false, scrollX: 0, scrollY: 0
        });
        area.classList.remove('capture-mode');

        // 表示を元に戻す
        if (mode !== 'show' && ipEl)     ipEl.textContent  = originalIP;
        if (devMode !== 'show' && devEl) devEl.textContent = originalDev;

        capturedDataUrl = canvas.toDataURL('image/png', 1.0);

        // モーダルにプレビュー表示
        const wrap = document.getElementById('result-img-wrap');
        wrap.innerHTML = '';
        const img = new Image();
        img.src = capturedDataUrl;
        wrap.appendChild(img);
        document.getElementById('modal-overlay').style.display = 'flex';

        // 完了トースト
        const toast = document.createElement('div');
        toast.textContent = tui().imgGenComplete;
        toast.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1c1c1e;color:#fff;padding:14px 28px;border-radius:40px;font-size:0.95rem;font-weight:700;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid #3a3a3c;z-index:999999;opacity:0;transition:opacity 0.3s;white-space:nowrap;';
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => document.body.removeChild(toast), 300); }, 2500);

    } catch(err) {
        area.classList.remove('capture-mode');
        if (mode !== 'show' && ipEl)     ipEl.textContent  = originalIP;
        if (devMode !== 'show' && devEl) devEl.textContent = originalDev;
        console.error(err);
        alert('画像生成中にエラーが発生しました。\n' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = _getLang().saveBtnTxt || '診断レポートを画像で保存する';
    }
}

function downloadCapturedImage() {
    if (!capturedDataUrl) { alert('先にキャプチャを生成してください。'); return; }
    const filename = 'device-diagnostic-' + new Date().toISOString().slice(0,10) + '.png';
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
        // iOSはaタグのdownload属性が効かないので新しいタブで開く
        const w = window.open();
        if (w) {
            w.document.write('<img src="' + capturedDataUrl + '" style="max-width:100%">');
            w.document.write('<p style="font-family:sans-serif;color:#333;font-size:14px;">画像を長押し → 「写真に保存」でダウンロードできます</p>');
            w.document.title = filename;
        } else {
            // ポップアップブロックされた場合
            window.location.href = capturedDataUrl;
        }
        return;
    }
    const a = document.createElement('a');
    a.href = capturedDataUrl;
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ── 履歴保存・表示・削除 ── */
function deleteHistory(index) {
    try {
        const history = JSON.parse(localStorage.getItem('diag_history') || '[]');
        history.splice(index, 1);
        localStorage.setItem('diag_history', JSON.stringify(history));
        syncHistoryToCloud(history);
        showHistoryModal();
    } catch(e) {}
}
function renameHistory(index) {
    try {
        const history = JSON.parse(localStorage.getItem('diag_history') || '[]');
        const current = history[index]?.name || '';
        // カードのテキスト部分をインライン入力に差し替え
        const card = document.querySelector(`[data-card-index="${index}"]`);
        if (!card) return;
        const nameDiv = card.querySelector('.history-name-area');
        if (!nameDiv) return;
        nameDiv.innerHTML = `
            <div style="display:flex;gap:6px;margin-bottom:6px;">
                <input id="rename-input-${index}" type="text" value="${current.replace(/"/g,'&quot;')}"
                    style="flex:1;background:#2a2a2a;border:1px solid var(--accent);border-radius:8px;padding:6px 10px;color:#fff;font-size:0.9rem;outline:none;"
                    placeholder="例: YouTube重い時">
                <button data-action="rename-save" data-index="${index}"
                    style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;cursor:pointer;font-size:0.85rem;">保存</button>
                <button data-action="rename-cancel" data-index="${index}"
                    style="background:#333;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-weight:800;cursor:pointer;font-size:0.85rem;">✕</button>
            </div>`;
        document.getElementById(`rename-input-${index}`)?.focus();
    } catch(e) { console.error(e); }
}

function saveRename(index) {
    try {
        const val = document.getElementById(`rename-input-${index}`)?.value || '';
        const history = JSON.parse(localStorage.getItem('diag_history') || '[]');
        history[index].name = val.trim();
        localStorage.setItem('diag_history', JSON.stringify(history));
        showHistoryModal();
    } catch(e) {}
}

/* ── 履歴保存・表示 ── */
function saveResultToHistory(totalScore, rank, scores, ramGB, avgFps, lowFps, networkMbps) {
    try {
        const entry = {
            date: new Date().toLocaleString('ja-JP'),
            name: '',
            totalScore, rank,
            cpu: scores.cpu, gpu: scores.gpu, mem: scores.mem, fps: scores.fps,
            ramGB, avgFps, lowFps,
            networkMbps: networkMbps ?? null
        };
        const history = JSON.parse(localStorage.getItem('diag_history') || '[]');
        history.unshift(entry);
        const maxHistory = _currentUser ? 5 : 3;
        if (history.length > maxHistory) history.splice(maxHistory);
        localStorage.setItem('diag_history', JSON.stringify(history));
        // クラウド同期
        syncHistoryToCloud(history);
    } catch(e) {}
}

function showHistoryModal() {
    const modal = document.getElementById('history-modal');
    const cont  = document.getElementById('history-content');
    let history = [];
    try { history = JSON.parse(localStorage.getItem('diag_history') || '[]'); } catch(e) {}

    // ログイン特典バッジ
    const maxHistory = _currentUser ? 5 : 3;
    const benefitBadge = _currentUser
        ? '<div style="background:linear-gradient(135deg,#6366f1,#a78bfa);color:#fff;font-size:0.75rem;font-weight:700;padding:4px 12px;border-radius:20px;display:inline-block;margin-bottom:12px;">⭐ ログイン特典：最大5件保存 / 固定機能解放</div>'
        : '<div style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a78bfa;font-size:0.75rem;font-weight:700;padding:4px 12px;border-radius:20px;display:inline-block;margin-bottom:12px;cursor:pointer;" onclick="openLoginModal()">🔒 ログインで最大5件保存・固定機能が解放</div>';

    if (history.length === 0) {
        cont.innerHTML = benefitBadge + '<p style="color:var(--sub-text);text-align:center;padding:20px;">まだ診断結果がありません。</p>';
    } else {
        // 固定されたものを先頭に
        const pinned   = history.filter(h => h.pinned);
        const unpinned = history.filter(h => !h.pinned);
        const sorted   = [...pinned, ...unpinned];

        const rankColors = {S:'#ff3b30',A:'#ff9500',B:'#34c759',C:'#007aff',D:'#8e8e93'};
        const cards = sorted.map((h, i) => {
            const origIdx = history.indexOf(h);
            return `
            <div data-card-index="${origIdx}" style="background:#1a1a1a;border:1px solid ${h.pinned ? '#6366f1' : 'var(--border)'};border-radius:16px;padding:18px;margin-bottom:12px;${h.pinned ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
                    <div style="width:52px;height:52px;border-radius:12px;background:#000;border:3px solid ${rankColors[h.rank]||'#888'};display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:900;color:${rankColors[h.rank]||'#888'};">${h.rank}</div>
                    <div style="flex:1;min-width:0;">
                        <div class="history-name-area">${h.name ? `<div style="font-weight:800;font-size:0.9rem;color:#6bb5ff;margin-bottom:2px;">📌 ${h.name}</div>` : ''}</div>
                        ${h.pinned ? '<div style="font-size:0.72rem;color:#a78bfa;font-weight:700;margin-bottom:2px;">📍 固定中</div>' : ''}
                        <div style="font-weight:800;font-size:1.1rem;">総合スコア ${h.totalScore}/100</div>
                        <div style="color:var(--sub-text);font-size:0.82rem;">${h.date}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:0.82rem;">
                    <div style="background:#222;border-radius:8px;padding:8px;text-align:center;"><div style="color:var(--sub-text);">CPU</div><div style="font-weight:800;">${h.cpu}pt</div></div>
                    <div style="background:#222;border-radius:8px;padding:8px;text-align:center;"><div style="color:var(--sub-text);">GPU</div><div style="font-weight:800;">${h.gpu}pt</div></div>
                    <div style="background:#222;border-radius:8px;padding:8px;text-align:center;"><div style="color:var(--sub-text);">RAM</div><div style="font-weight:800;">${h.ramGB}GB</div></div>
                    <div style="background:#222;border-radius:8px;padding:8px;text-align:center;"><div style="color:var(--sub-text);">avgFPS</div><div style="font-weight:800;">${h.avgFps}</div></div>
                    <div style="background:#222;border-radius:8px;padding:8px;text-align:center;"><div style="color:var(--sub-text);">1%LOW</div><div style="font-weight:800;">${h.lowFps}</div></div>
                    <div style="background:#222;border-radius:8px;padding:8px;text-align:center;"><div style="color:var(--sub-text);">NET</div><div style="font-weight:800;">${h.networkMbps!=null?h.networkMbps+'M':'--'}</div></div>
                </div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    ${_currentUser ? `<button data-action="pin" data-index="${origIdx}" style="flex:1;padding:9px;border-radius:10px;background:${h.pinned ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.1)'};border:1px solid rgba(99,102,241,0.4);color:#a78bfa;font-size:0.82rem;font-weight:700;cursor:pointer;">${h.pinned ? '📍 固定解除' : '📌 固定'}</button>` : ''}
                    <button data-action="rename" data-index="${origIdx}" style="flex:1;padding:9px;border-radius:10px;background:rgba(0,122,255,0.15);border:1px solid rgba(0,122,255,0.3);color:#6bb5ff;font-size:0.82rem;font-weight:700;cursor:pointer;">✏️ 名前をつける</button>
                    <button data-action="delete" data-index="${origIdx}" style="flex:1;padding:9px;border-radius:10px;background:rgba(255,59,48,0.15);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;font-size:0.82rem;font-weight:700;cursor:pointer;">🗑 削除</button>
                </div>
            </div>`;
        }).join('');

        // スコア推移グラフ（2件以上のとき表示）
        let graphHtml = '';
        if (history.length >= 2) {
            graphHtml = `
            <div style="background:#1a1a1a;border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:12px;">
                <div style="font-size:0.85rem;font-weight:800;color:var(--sub-text);margin-bottom:10px;">📈 スコア推移</div>
                <canvas id="score-chart" height="120" style="width:100%;"></canvas>
            </div>`;
        }

        cont.innerHTML = benefitBadge + graphHtml + cards;

        // グラフ描画
        if (history.length >= 2) {
            const ctx = document.getElementById('score-chart');
            if (ctx) drawScoreChart(ctx, [...history].reverse());
        }
    }
    modal.style.display = 'flex';

    cont.onclick = (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.index);
        if (btn.dataset.action === 'pin')           togglePin(idx);
        if (btn.dataset.action === 'rename')        renameHistory(idx);
        if (btn.dataset.action === 'rename-save')   saveRename(idx);
        if (btn.dataset.action === 'rename-cancel') showHistoryModal();
        if (btn.dataset.action === 'delete')        deleteHistory(idx);
    };
}

function togglePin(idx) {
    try {
        const history = JSON.parse(localStorage.getItem('diag_history') || '[]');
        if (!history[idx]) return;
        history[idx].pinned = !history[idx].pinned;
        localStorage.setItem('diag_history', JSON.stringify(history));
        showHistoryModal();
    } catch(e) {}
}

function drawScoreChart(canvas, history) {
    const W = canvas.offsetWidth || 300;
    canvas.width  = W * 2;
    canvas.height = 240;
    canvas.style.width  = '100%';
    canvas.style.height = '120px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);
    const w = W, h = 120;
    const pad = { top: 10, right: 16, bottom: 28, left: 32 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    const scores   = history.map(h => h.totalScore);
    const labels   = history.map(h => h.date.slice(5, 10)); // MM/DD
    const maxS     = Math.max(...scores, 60);
    const minS     = Math.max(0, Math.min(...scores) - 10);
    const n        = scores.length;

    const xPos = i => pad.left + (i / (n - 1)) * cw;
    const yPos = s => pad.top + ch - ((s - minS) / (maxS - minS)) * ch;

    // グリッド線
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    [0, 0.5, 1].forEach(t => {
        const y = pad.top + ch * t;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    });

    // グラデーション塗り
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, 'rgba(0,122,255,0.35)');
    grad.addColorStop(1, 'rgba(0,122,255,0)');
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(scores[0]));
    scores.forEach((s, i) => { if (i > 0) ctx.lineTo(xPos(i), yPos(s)); });
    ctx.lineTo(xPos(n-1), pad.top + ch);
    ctx.lineTo(xPos(0),   pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // ライン
    ctx.beginPath();
    ctx.strokeStyle = '#007aff';
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    scores.forEach((s, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(s)) : ctx.lineTo(xPos(i), yPos(s)); });
    ctx.stroke();

    // 点とスコア値
    scores.forEach((s, i) => {
        ctx.beginPath();
        ctx.arc(xPos(i), yPos(s), 4, 0, Math.PI * 2);
        ctx.fillStyle   = '#fff';
        ctx.strokeStyle = '#007aff';
        ctx.lineWidth   = 2;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle  = '#fff';
        ctx.font       = 'bold 9px sans-serif';
        ctx.textAlign  = 'center';
        ctx.fillText(s, xPos(i), yPos(s) - 8);
    });

    // 日付ラベル
    ctx.fillStyle  = 'rgba(255,255,255,0.4)';
    ctx.font       = '8px sans-serif';
    ctx.textAlign  = 'center';
    labels.forEach((l, i) => ctx.fillText(l, xPos(i), h - 4));
}

/* ── ページ読み込み速度テスト ── */
async function showSpeedModal() {
    document.getElementById('speed-modal').style.display = 'flex';
    document.getElementById('speed-results').innerHTML = '';
}

// XMLHttpRequest + GET方式（Chromebook企業ポリシー環境でも動作）
// no-corsのfetchやHEADメソッドはブロックされやすいため
// 同期的なタイミングが取れるXHRを使用
// 計測カウンター（毎回完全にユニークなURLを生成するため）
let _speedCounter = 0;

function measureOnce(url) {
    return new Promise(resolve => {
        _speedCounter++;
        const unique = '?bust=' + Date.now() + '_' + _speedCounter + '_' + Math.random().toString(36).slice(2);

        // 前回の結果をキャッシュさせないためにImageオブジェクトを毎回新規生成
        const img = document.createElement('img');
        img.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(img);

        const t0 = performance.now();
        let done = false;

        const fin = () => {
            if (done) return;
            done = true;
            document.body.removeChild(img);
            const ms = Math.round(performance.now() - t0);
            // 3ms以下はキャッシュ or ローカルブロック → null扱い
            resolve(ms > 3 ? ms : null);
        };

        img.onload  = fin;
        img.onerror = fin;
        img.src = url + unique;

        setTimeout(() => {
            if (done) return;
            done = true;
            try { document.body.removeChild(img); } catch(e) {}
            resolve(null);
        }, 8000);
    });
}

// 3回計測して中央値を返す
async function measureLoadTime(url) {
    const results = [];
    for (let i = 0; i < 3; i++) {
        const ms = await measureOnce(url);
        if (ms !== null) results.push(ms);
        // 計測間に間隔を空けてブラウザの最適化を防ぐ
        await new Promise(r => setTimeout(r, 300));
    }
    if (results.length === 0) return null;
    results.sort((a, b) => a - b);
    return results[Math.floor(results.length / 2)];
}


async function runSpeedTest() {
    const resultsEl = document.getElementById('speed-results');
    const runBtn    = document.getElementById('speed-run-btn');
    runBtn.disabled = true;
    runBtn.textContent = '計測中...';

    const targets = [
        { name: 'Google',       url: 'https://www.google.com/favicon.ico' },
        { name: 'YouTube',      url: 'https://www.youtube.com/favicon.ico' },
        { name: 'Wikipedia',    url: 'https://ja.wikipedia.org/favicon.ico' },
        { name: 'Amazon',       url: 'https://www.amazon.co.jp/favicon.ico' },
        { name: 'GitHub',       url: 'https://github.com/favicon.ico' },
        { name: 'X (Twitter)',  url: 'https://abs.twimg.com/favicons/twitter.3.ico' },
        { name: 'Instagram',    url: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsNE-OHk_8a.png' },
        { name: 'Cloudflare',   url: 'https://1.1.1.1/favicon.ico' },
    ];

    resultsEl.innerHTML = '<p style="color:var(--sub-text);font-size:0.85rem;margin:0 0 12px;">各サイトへの接続時間を3回計測して中央値を表示します</p>';

    for (const t of targets) {
        const rowEl = document.createElement('div');
        rowEl.style.cssText = 'background:#1a1a1a;border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
        rowEl.innerHTML = `<span style="font-weight:700;">${t.name}</span><span style="color:var(--sub-text);font-size:0.85rem;">3回計測中...</span>`;
        resultsEl.appendChild(rowEl);

        const ms = await measureLoadTime(t.url);
        if (ms !== null) {
            const color = ms < 150 ? 'var(--st-ok)' : ms < 400 ? 'var(--st-warn)' : 'var(--st-bad)';
            const label = ms < 150 ? '高速' : ms < 400 ? '普通' : '低速';
            rowEl.style.borderLeft = '4px solid ' + color;
            rowEl.style.background = ms < 150 ? 'rgba(0,122,255,0.08)' : ms < 400 ? 'rgba(255,204,0,0.08)' : 'rgba(255,59,48,0.08)';
            rowEl.innerHTML = `<span style="font-weight:700;">${t.name}</span><span style="font-weight:800;color:${color};">${ms} ms <span style="font-size:0.78rem;opacity:0.8;">${label}</span></span>`;
        } else {
            rowEl.innerHTML = `<span style="font-weight:700;">${t.name}</span><span style="color:#8e8e93;font-weight:700;">タイムアウト</span>`;
        }
    }

    runBtn.disabled = false;
    runBtn.textContent = '🚀 再テスト';
}

function retryDiagnostic() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }, 50);
    const _t2 = _getLang();
    document.getElementById('rank-letter').textContent = '?';
    document.getElementById('rank-letter').className   = 'rank-D';
    document.getElementById('status-title').textContent = _t2.statusTitle;
    document.getElementById('eval-msg').textContent     = _t2.evalMsg;
    document.getElementById('b-fps-avg').textContent    = '-- FPS';
    document.getElementById('b-fps-low').textContent    = '-- FPS';
    document.getElementById('ai-btn').style.display      = 'none';
    document.getElementById('save-btn').style.display    = 'none';
    document.getElementById('share-hint').style.display  = 'none';
    document.getElementById('history-btn').style.display = 'none';
    document.getElementById('speed-btn').style.display   = 'none';
    document.getElementById('battle-btn').style.display  = 'none';
    document.getElementById('retry-btn').style.display   = 'none';
    const trEl = document.getElementById('time-remaining');
    if (trEl) trEl.textContent = '';

    // 全行を -- にリセット
    for (let i = 1; i <= 34; i++) {
        const v = document.getElementById('v-' + i);
        const r = document.getElementById('row-' + i);
        if (v) v.textContent = '--';
        if (r) { r.className = 'spec-row'; r.style.display = ''; }
    }

    // スコア・診断データをリセット
    scores.cpu = 0; scores.gpu = 0; scores.mem = 0; scores.fps = 0;
    Object.keys(diag).forEach(k => delete diag[k]);
    capturedDataUrl = null;

    // 再計測開始
    runBenchmark();
}

// ══════════════════════════════════════════════════════════════
// Firebase 設定（自分のFirebaseプロジェクトの値に書き換えてください）
// https://console.firebase.google.com でプロジェクトを作成後、
// 「プロジェクトの設定」→「マイアプリ」→「Firebase SDK snippet」から取得
// ══════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyCjf0ASjsOctpSoNbBy9517Gb1cokT4jdg",
    authDomain:        "prp-ultra.firebaseapp.com",
    projectId:         "prp-ultra",
    storageBucket:     "prp-ultra.firebasestorage.app",
    messagingSenderId: "892784070484",
    appId:             "1:892784070484:web:a3aa47aaece7df862a02c1",
    measurementId:     "G-X38W2QE5V4"
};

// Firebase初期化
let _fbApp = null, _fbAuth = null, _fbDb = null;
let _currentUser = null;

// ── 友達コードログイン ──────────────────────────────────────────
// ランタイムのみで保持（ページリロード後はCookieから復元）
let _fc = { name: '', group: '' };

function _b64ToStr(b64) {
    try {
        const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch(e) { return ''; }
}

async function _hashCode(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ══════════════════════════════════════════════════════════════
// 👥 グループシステム（Beta 1.8）
// ══════════════════════════════════════════════════════════════

let _groupIsPublic = false;
let _groupIcon     = '🏆';
let _myGroups      = []; // 所属グループキャッシュ

// パスワードをSHA-256ハッシュ化
async function _hashPass(pass) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── 親友コードモーダルのメイン画面 ──
function openFriendModal() {
    const modal = document.getElementById('friend-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderFriendModalTop();
    modal.onclick = e => { if (e.target === modal) { modal.style.display='none'; document.body.style.overflow=''; } };
}

function renderFriendModalTop() {
    const cont = document.getElementById('friend-modal-content');
    const isLoggedIn = !!_currentUser;

    cont.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
            ${isLoggedIn ? `
                <button onclick="openGroupCreate()" style="padding:14px;border-radius:14px;background:linear-gradient(135deg,#ff9500,#ff6b00);color:#fff;border:none;font-size:0.95rem;font-weight:800;cursor:pointer;text-align:left;">
                    ✨ 新しいグループを作成する
                </button>
                <button onclick="renderJoinGroup()" style="padding:14px;border-radius:14px;background:rgba(255,149,0,0.15);border:1px solid rgba(255,149,0,0.4);color:#ff9500;font-size:0.95rem;font-weight:800;cursor:pointer;text-align:left;">
                    🔑 グループに参加する（コード入力）
                </button>
                <button onclick="renderMyGroups()" style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid #333;color:#ccc;font-size:0.95rem;font-weight:800;cursor:pointer;text-align:left;">
                    📋 参加中のグループ
                </button>
            ` : `
                <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:14px;padding:14px;margin-bottom:4px;">
                    <p style="color:#a78bfa;font-size:0.85rem;margin:0 0 10px;">グループを作成・管理するにはログインが必要です。</p>
                    <button onclick="openLoginModal()" style="width:100%;padding:10px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;font-weight:700;cursor:pointer;font-size:0.88rem;">🔐 ログインする（Google / GitHub）</button>
                </div>
                <button onclick="renderJoinGroup()" style="padding:14px;border-radius:14px;background:rgba(255,149,0,0.15);border:1px solid rgba(255,149,0,0.4);color:#ff9500;font-size:0.95rem;font-weight:800;cursor:pointer;text-align:left;">
                    🔑 グループに参加する（コード入力）
                </button>
            `}
            <button onclick="renderPublicGroups()" style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#888;font-size:0.9rem;font-weight:700;cursor:pointer;text-align:left;">
                🌐 公開グループ一覧を見る
            </button>
            <!-- 旧コード入力（別府小学校グループ等）-->
            <div style="border-top:1px solid #2a2a2a;padding-top:14px;margin-top:4px;">
                <p style="color:#555;font-size:0.78rem;margin:0 0 8px;">管理者から配布された旧コードをお持ちの方：</p>
                <div style="display:flex;gap:8px;">
                    <input id="friend-code-input" type="password" placeholder="旧コードを入力..." maxlength="20"
                        style="flex:1;background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:8px 12px;color:#fff;font-size:0.9rem;outline:none;text-align:center;letter-spacing:0.15em;">
                    <button onclick="checkFriendCode()" style="padding:8px 14px;border-radius:10px;background:#333;color:#888;border:none;font-weight:700;cursor:pointer;font-size:0.85rem;">入力</button>
                </div>
                <div id="friend-code-error" style="color:#ff3b30;font-size:0.78rem;margin-top:6px;display:none;">コードが違います</div>
            </div>
        </div>`;
}

// ── グループ参加（コード入力）──
function renderJoinGroup() {
    const cont = document.getElementById('friend-modal-content');
    cont.innerHTML = `
        <button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
        <p style="color:#ccc;font-size:0.85rem;margin:0 0 16px;">グループのオーナーから教えてもらったグループIDとパスワードを入力してください。</p>
        <div style="margin-bottom:12px;">
            <label style="display:block;color:#ccc;font-size:0.82rem;font-weight:700;margin-bottom:6px;">グループID</label>
            <input id="join-group-id" type="text" placeholder="グループID"
                style="width:100%;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#fff;font-size:0.95rem;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:16px;">
            <label style="display:block;color:#ccc;font-size:0.82rem;font-weight:700;margin-bottom:6px;">パスワード</label>
            <input id="join-group-pass" type="password" placeholder="パスワード"
                style="width:100%;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#fff;font-size:0.95rem;outline:none;box-sizing:border-box;">
        </div>
        <div id="join-group-error" style="color:#ff6b6b;font-size:0.82rem;margin-bottom:10px;display:none;"></div>
        <button onclick="submitJoinGroup()" style="width:100%;padding:13px;border-radius:14px;background:linear-gradient(135deg,#ff9500,#ff6b00);color:#fff;border:none;font-weight:800;cursor:pointer;font-size:0.95rem;">参加する</button>`;
}

async function submitJoinGroup() {
    if (!_fbDb) { alert('Firestoreが利用できません'); return; }
    const groupId = document.getElementById('join-group-id')?.value.trim();
    const pass    = document.getElementById('join-group-pass')?.value.trim();
    const errEl   = document.getElementById('join-group-error');

    if (!groupId || !pass) { errEl.style.display='block'; errEl.textContent='グループIDとパスワードを入力してください'; return; }

    try {
        const doc = await _fbDb.collection('groups').doc(groupId).get();
        if (!doc.exists) { errEl.style.display='block'; errEl.textContent='グループが見つかりません'; return; }
        const group = doc.data();
        const hash  = await _hashPass(pass);
        if (hash !== group.passwordHash) { errEl.style.display='block'; errEl.textContent='パスワードが違います'; return; }
        if (group.members && group.members.length >= 5) { errEl.style.display='block'; errEl.textContent='このグループは満員です（5人上限）'; return; }
        if (group.members && group.members.some(m => m.uid === _currentUser?.uid)) {
            errEl.style.display='block'; errEl.textContent='すでに参加しています'; return;
        }

        const me = { uid: _currentUser?.uid || 'guest', name: _currentUser?.displayName || _currentUser?.email?.split('@')[0] || 'ゲスト', role: 'member', joinedAt: Date.now() };
        await _fbDb.collection('groups').doc(groupId).update({
            members:    firebase.firestore.FieldValue.arrayUnion(me),
            memberUids: firebase.firestore.FieldValue.arrayUnion(_currentUser?.uid || 'guest'),
        });
        alert(`✅ 「${group.icon} ${group.name}」に参加しました！`);
        renderFriendModalTop();
    } catch(e) {
        errEl.style.display='block'; errEl.textContent='エラー: ' + e.message;
    }
}

// ── 参加中のグループ一覧 ──
async function renderMyGroups() {
    const cont = document.getElementById('friend-modal-content');
    cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
        <p style="color:#888;text-align:center;">読み込み中...</p>`;
    if (!_fbDb || !_currentUser) return;

    try {
        const snap = await _fbDb.collection('groups')
            .where('memberUids', 'array-contains', _currentUser.uid).get();
        if (snap.empty) {
            cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
                <p style="color:#888;text-align:center;padding:20px;">まだグループに参加していません。</p>`;
            return;
        }
        const cards = snap.docs.map(d => {
            const g = d.data();
            const isOwner = g.ownerId === _currentUser.uid;
            return `<div style="background:#1a1a1a;border:1px solid ${isOwner?'#ff9500':'#2a2a2a'};border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="openGroupDetail('${d.id}')">
                <div style="font-size:2rem;">${g.icon}</div>
                <div style="flex:1;">
                    <div style="font-weight:800;color:#fff;font-size:0.95rem;">${g.name}</div>
                    <div style="color:#666;font-size:0.75rem;">${isOwner?'👑 オーナー':'👤 メンバー'} ・ ${g.members?.length||0}/5人 ${g.isPublic?'🌐 公開':'🔒 非公開'}</div>
                </div>
                <div style="color:#555;font-size:0.85rem;">›</div>
            </div>`;
        }).join('');
        cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>${cards}`;
    } catch(e) {
        cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
            <p style="color:#ff6b6b;text-align:center;">エラー: ${e.message}</p>`;
    }
}

// ── 公開グループ一覧 ──
async function renderPublicGroups() {
    const cont = document.getElementById('friend-modal-content');
    cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
        <p style="color:#888;text-align:center;">読み込み中...</p>`;
    if (!_fbDb) return;

    try {
        const snap = await _fbDb.collection('groups').where('isPublic','==',true).limit(20).get();
        if (snap.empty) {
            cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
                <p style="color:#888;text-align:center;padding:20px;">公開グループがまだありません。</p>`;
            return;
        }
        const cards = snap.docs.map(d => {
            const g   = d.data();
            const full = (g.members?.length||0) >= 5;
            return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">
                <div style="font-size:2rem;">${g.icon}</div>
                <div style="flex:1;">
                    <div style="font-weight:800;color:#fff;font-size:0.95rem;">${g.name}</div>
                    <div style="color:#666;font-size:0.75rem;">${g.members?.length||0}/5人 ・ ID: ${d.id}</div>
                </div>
                ${full
                    ? '<div style="color:#ff6b6b;font-size:0.75rem;font-weight:700;">満員</div>'
                    : `<button onclick="prefillJoin('${d.id}')" style="padding:6px 14px;border-radius:10px;background:rgba(255,149,0,0.2);border:1px solid rgba(255,149,0,0.4);color:#ff9500;font-size:0.8rem;font-weight:700;cursor:pointer;">参加</button>`
                }
            </div>`;
        }).join('');
        cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
            <p style="color:#888;font-size:0.8rem;margin:0 0 12px;">グループIDとパスワードはオーナーに確認してください。</p>${cards}`;
    } catch(e) {
        cont.innerHTML = `<button onclick="renderFriendModalTop()" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;margin-bottom:16px;padding:0;">← 戻る</button>
            <p style="color:#ff6b6b;">エラー: ${e.message}</p>`;
    }
}

function prefillJoin(groupId) {
    renderJoinGroup();
    setTimeout(() => {
        const el = document.getElementById('join-group-id');
        if (el) el.value = groupId;
    }, 50);
}

// ── グループ作成 ──
function openGroupCreate() {
    if (!_currentUser) { openLoginModal(); return; }
    _groupIcon     = '🏆';
    _groupIsPublic = false;
    document.getElementById('group-create-modal').style.display = 'flex';
    document.getElementById('group-icon-selected').textContent  = '🏆';
}

function closeGroupCreate() {
    document.getElementById('group-create-modal').style.display = 'none';
}

function toggleIconPicker() {
    const p = document.getElementById('group-icon-picker');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function selectGroupIcon(emoji) {
    _groupIcon = emoji;
    document.getElementById('group-icon-selected').textContent = emoji;
    document.getElementById('group-icon-picker').style.display = 'none';
}

function toggleGroupPublic() {
    _groupIsPublic = !_groupIsPublic;
    const tog   = document.getElementById('group-public-toggle');
    const thumb = document.getElementById('group-public-thumb');
    tog.style.background = _groupIsPublic ? '#34c759' : '#555';
    thumb.style.left  = _groupIsPublic ? 'auto' : '2px';
    thumb.style.right = _groupIsPublic ? '2px'  : 'auto';
}

async function submitCreateGroup() {
    if (!_fbDb || !_currentUser) return;
    const name  = document.getElementById('group-name-input')?.value.trim();
    const pass  = document.getElementById('group-pass-input')?.value;
    const pass2 = document.getElementById('group-pass-confirm')?.value;
    const errEl = document.getElementById('group-create-error');

    if (!name)          { errEl.style.display='block'; errEl.textContent='グループ名を入力してください'; return; }
    if (!pass)          { errEl.style.display='block'; errEl.textContent='パスワードを入力してください'; return; }
    if (pass !== pass2) { errEl.style.display='block'; errEl.textContent='パスワードが一致しません'; return; }

    try {
        const hash = await _hashPass(pass);
        const me   = { uid: _currentUser.uid, name: _currentUser.displayName || 'オーナー', role: 'owner', joinedAt: Date.now() };
        const ref  = await _fbDb.collection('groups').add({
            name,
            icon:         _groupIcon,
            passwordHash: hash,
            isPublic:     _groupIsPublic,
            ownerId:      _currentUser.uid,
            ownerName:    _currentUser.displayName || 'オーナー',
            members:      [me],
            memberUids:   [_currentUser.uid],
            createdAt:    Date.now(),
        });
        closeGroupCreate();
        alert(`✅ グループ「${_groupIcon} ${name}」を作成しました！\n\nグループID: ${ref.id}\nこのIDを友達に教えてください。`);
        renderFriendModalTop();
    } catch(e) {
        errEl.style.display='block'; errEl.textContent='エラー: ' + e.message;
    }
}

// ── グループ詳細 ──
async function openGroupDetail(groupId) {
    if (!_fbDb) return;
    const modal = document.getElementById('group-detail-modal');
    const cont  = document.getElementById('group-detail-content');
    modal.style.display = 'flex';
    cont.innerHTML = '<p style="color:#888;text-align:center;">読み込み中...</p>';

    try {
        const doc = await _fbDb.collection('groups').doc(groupId).get();
        if (!doc.exists) { cont.innerHTML='<p style="color:#ff6b6b;">グループが見つかりません</p>'; return; }
        const g        = doc.data();
        const isOwner  = g.ownerId === _currentUser?.uid;
        const isSub    = g.members?.find(m => m.uid === _currentUser?.uid)?.role === 'sub';
        const canDelete = isOwner || isSub;

        document.getElementById('group-detail-title').textContent = g.icon + ' ' + g.name;

        const memberRows = (g.members||[]).map(m => {
            const roleLabel = m.role === 'owner' ? '👑' : m.role === 'sub' ? '⭐' : '👤';
            const isMe      = m.uid === _currentUser?.uid;
            const canKick   = canDelete && !isMe && m.role !== 'owner';
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #2a2a2a;">
                <div style="font-size:1.2rem;">${roleLabel}</div>
                <div style="flex:1;">
                    <div style="color:#fff;font-size:0.9rem;font-weight:700;">${m.name}${isMe?' (自分)':''}</div>
                    <div style="color:#666;font-size:0.75rem;">${new Date(m.joinedAt).toLocaleDateString('ja-JP')} 参加</div>
                </div>
                ${canKick ? `<button onclick="requestDeleteMember('${groupId}','${m.uid}','${m.name}')" style="padding:4px 12px;border-radius:8px;background:rgba(255,59,48,0.15);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;font-size:0.75rem;font-weight:700;cursor:pointer;">削除申請</button>` : ''}
                ${isOwner && m.role === 'member' ? `<button onclick="promoteToSub('${groupId}','${m.uid}')" style="padding:4px 12px;border-radius:8px;background:rgba(255,149,0,0.15);border:1px solid rgba(255,149,0,0.3);color:#ff9500;font-size:0.75rem;font-weight:700;cursor:pointer;">副オーナーに</button>` : ''}
            </div>`;
        }).join('');

        // 保留中の削除申請
        const pendingSnap = await _fbDb.collection('group_delete_requests')
            .where('groupId','==',groupId).where('status','==','pending').get();
        const pendingHtml = pendingSnap.docs.filter(d => d.data().targetUid === _currentUser?.uid).map(d => {
            const req = d.data();
            return `<div style="background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);border-radius:12px;padding:12px;margin-bottom:10px;">
                <p style="color:#ff6b6b;font-size:0.85rem;margin:0 0 8px;">⚠️ 「${req.requestedByName}」さんからあなたの削除申請が来ています</p>
                <div style="display:flex;gap:8px;">
                    <button onclick="approveDeletion('${d.id}','${groupId}')" style="flex:1;padding:8px;border-radius:10px;background:rgba(255,59,48,0.2);border:1px solid rgba(255,59,48,0.4);color:#ff6b6b;font-size:0.82rem;font-weight:700;cursor:pointer;">承認して退出</button>
                    <button onclick="rejectDeletion('${d.id}')" style="flex:1;padding:8px;border-radius:10px;background:#222;border:1px solid #333;color:#888;font-size:0.82rem;font-weight:700;cursor:pointer;">拒否</button>
                </div>
            </div>`;
        }).join('');

        cont.innerHTML = `
            ${pendingHtml}
            <div style="background:#1a1a1a;border-radius:12px;padding:12px;margin-bottom:16px;">
                <div style="color:#888;font-size:0.75rem;margin-bottom:4px;">グループID（参加者に共有）</div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <code style="color:#ff9500;font-size:0.9rem;flex:1;">${groupId}</code>
                    <button onclick="navigator.clipboard.writeText('${groupId}').then(()=>alert('コピーしました！'))" style="padding:4px 10px;border-radius:8px;background:#333;border:none;color:#888;font-size:0.75rem;cursor:pointer;">コピー</button>
                </div>
                <div style="color:#555;font-size:0.72rem;margin-top:4px;">${g.isPublic?'🌐 公開':'🔒 非公開'} ・ ${g.members?.length||0}/5人</div>
            </div>
            <div style="margin-bottom:16px;">${memberRows}</div>
            ${isOwner ? `
                <div style="display:grid;gap:8px;margin-top:16px;border-top:1px solid #2a2a2a;padding-top:16px;">
                    <button onclick="editGroupName('${groupId}')" style="padding:10px;border-radius:12px;background:rgba(0,122,255,0.1);border:1px solid rgba(0,122,255,0.3);color:#6bb5ff;font-size:0.85rem;font-weight:700;cursor:pointer;">✏️ グループ名を変更</button>
                    <button onclick="editGroupPass('${groupId}')" style="padding:10px;border-radius:12px;background:rgba(0,122,255,0.1);border:1px solid rgba(0,122,255,0.3);color:#6bb5ff;font-size:0.85rem;font-weight:700;cursor:pointer;">🔑 パスワードを変更</button>
                    <button onclick="dissolveGroup('${groupId}')" style="padding:10px;border-radius:12px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;font-size:0.85rem;font-weight:700;cursor:pointer;">🗑 グループを解散</button>
                </div>
            ` : `
                <button onclick="leaveGroup('${groupId}')" style="width:100%;margin-top:16px;padding:10px;border-radius:12px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;font-size:0.85rem;font-weight:700;cursor:pointer;">退出する</button>
            `}`;
    } catch(e) {
        cont.innerHTML = `<p style="color:#ff6b6b;">エラー: ${e.message}</p>`;
    }
}

function closeGroupDetail() {
    document.getElementById('group-detail-modal').style.display = 'none';
}

// ── メンバー削除申請 ──
async function requestDeleteMember(groupId, targetUid, targetName) {
    if (!_fbDb || !_currentUser) return;
    if (!confirm(`「${targetName}」さんの削除を申請しますか？\n相手が承認するとグループから退出されます。`)) return;
    try {
        await _fbDb.collection('group_delete_requests').add({
            groupId,
            targetUid,
            targetName,
            requestedBy:     _currentUser.uid,
            requestedByName: _currentUser.displayName || 'オーナー',
            status:          'pending',
            createdAt:       Date.now(),
        });
        alert('✅ 削除申請を送りました。相手の承認をお待ちください。');
    } catch(e) { alert('エラー: ' + e.message); }
}

async function approveDeletion(requestId, groupId) {
    if (!_fbDb || !_currentUser) return;
    if (!confirm('削除申請を承認してグループを退出しますか？')) return;
    try {
        // メンバー配列から自分を除去
        const doc = await _fbDb.collection('groups').doc(groupId).get();
        const g   = doc.data();
        const newMembers  = g.members.filter(m => m.uid !== _currentUser.uid);
        const newMemberUids = g.memberUids.filter(u => u !== _currentUser.uid);
        await _fbDb.collection('groups').doc(groupId).update({ members: newMembers, memberUids: newMemberUids });
        await _fbDb.collection('group_delete_requests').doc(requestId).update({ status: 'approved' });
        alert('✅ グループから退出しました');
        closeGroupDetail();
        renderFriendModalTop();
    } catch(e) { alert('エラー: ' + e.message); }
}

async function rejectDeletion(requestId) {
    if (!_fbDb) return;
    await _fbDb.collection('group_delete_requests').doc(requestId).update({ status: 'rejected' });
    alert('❌ 削除申請を拒否しました');
    closeGroupDetail();
}

// ── 副オーナーに昇格 ──
async function promoteToSub(groupId, targetUid) {
    if (!_fbDb || !_currentUser) return;
    if (!confirm('このメンバーを副オーナーに昇格しますか？')) return;
    try {
        const doc = await _fbDb.collection('groups').doc(groupId).get();
        const g   = doc.data();
        const newMembers = g.members.map(m => m.uid === targetUid ? { ...m, role: 'sub' } : m);
        await _fbDb.collection('groups').doc(groupId).update({ members: newMembers });
        alert('✅ 副オーナーに昇格しました');
        openGroupDetail(groupId);
    } catch(e) { alert('エラー: ' + e.message); }
}

// ── グループ名変更 ──
async function editGroupName(groupId) {
    const newName = prompt('新しいグループ名を入力してください（20文字以内）');
    if (!newName || !newName.trim()) return;
    if (newName.trim().length > 20) { alert('20文字以内で入力してください'); return; }
    try {
        await _fbDb.collection('groups').doc(groupId).update({ name: newName.trim() });
        alert('✅ グループ名を変更しました');
        openGroupDetail(groupId);
    } catch(e) { alert('エラー: ' + e.message); }
}

// ── パスワード変更 ──
async function editGroupPass(groupId) {
    const newPass = prompt('新しいパスワードを入力してください');
    if (!newPass) return;
    const confirm2 = prompt('もう一度入力してください');
    if (newPass !== confirm2) { alert('パスワードが一致しません'); return; }
    try {
        const hash = await _hashPass(newPass);
        await _fbDb.collection('groups').doc(groupId).update({ passwordHash: hash });
        alert('✅ パスワードを変更しました');
    } catch(e) { alert('エラー: ' + e.message); }
}

// ── グループ解散 ──
async function dissolveGroup(groupId) {
    if (!confirm('本当にグループを解散しますか？\nこの操作は取り消せません。')) return;
    try {
        await _fbDb.collection('groups').doc(groupId).delete();
        alert('✅ グループを解散しました');
        closeGroupDetail();
        renderFriendModalTop();
    } catch(e) { alert('エラー: ' + e.message); }
}

// ── グループ退出（メンバー）──
async function leaveGroup(groupId) {
    if (!_currentUser || !_fbDb) return;
    if (!confirm('グループを退出しますか？')) return;
    try {
        const doc = await _fbDb.collection('groups').doc(groupId).get();
        const g   = doc.data();
        const newMembers    = g.members.filter(m => m.uid !== _currentUser.uid);
        const newMemberUids = g.memberUids.filter(u => u !== _currentUser.uid);
        await _fbDb.collection('groups').doc(groupId).update({ members: newMembers, memberUids: newMemberUids });
        alert('✅ グループから退出しました');
        closeGroupDetail();
        renderFriendModalTop();
    } catch(e) { alert('エラー: ' + e.message); }
}

const _CODE_MAP = {
    'ef56e0095f7d7fa387680bd5c14f6462a0948ccc16079503c6d5a721b05519d9': '56aP5bKh5biC56uL5Yil5bqc5bCP5a2m5qCh'
};

function _getGroupFromHash(hash) {
    const b64 = _CODE_MAP[hash];
    return b64 ? _b64ToStr(b64) : null;
}

async function checkFriendCode() {
    const input = document.getElementById('friend-code-input').value.trim();
    const errEl = document.getElementById('friend-code-error');
    const hash  = await _hashCode(input);
    const group = _getGroupFromHash(hash);

    if (group) {
        errEl.style.display = 'none';
        _fc.group = group;
        // Cookieに保存（30日）
        const exp = new Date(Date.now() + 30*24*60*60*1000).toUTCString();
        document.cookie = 'fc_auth=1; expires=' + exp + '; path=/; SameSite=Strict';
        document.cookie = 'fc_gb64=' + encodeURIComponent(_CODE_MAP[hash]) + '; expires=' + exp + '; path=/; SameSite=Strict';
        document.getElementById('friend-modal').style.display = 'none';
        showFriendNameModal(group);
    } else {
        errEl.style.display = 'block';
        document.getElementById('friend-code-input').value = '';
    }
}

function checkFriendCookie() {
    return document.cookie.split(';').some(c => c.trim().startsWith('fc_auth=1'));
}

function loadFriendFromCookie() {
    // グループ
    const gc = document.cookie.split(';').find(c => c.trim().startsWith('fc_gb64='));
    if (gc) {
        const b64 = decodeURIComponent(gc.trim().split('=').slice(1).join('='));
        _fc.group = _b64ToStr(b64) || '';
    }
    // 名前
    const nc = document.cookie.split(';').find(c => c.trim().startsWith('fc_nm='));
    if (nc) {
        _fc.name = decodeURIComponent(nc.trim().split('=').slice(1).join('=')) || '';
    }
}

function showFriendNameModal(group) {
    const existing = document.getElementById('friend-name-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'friend-name-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:999999;display:flex;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;';

    const h2 = document.createElement('h2');
    h2.style.cssText = 'margin:0 0 6px;font-size:1rem;font-weight:800;color:#34c759;';
    h2.textContent = group;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'background:#1a1a2e;border:1px solid #34c759;border-radius:24px;padding:28px;width:100%;max-width:360px;text-align:center;';
    wrapper.innerHTML = '<div style="font-size:1.8rem;margin-bottom:8px;">👋</div>';
    wrapper.appendChild(h2);
    wrapper.innerHTML += '<p style="color:#888;font-size:0.85rem;margin:0 0 18px;line-height:1.6;">ニックネームを入力してください<br>（スキップも可）</p>' +
        '<input id="friend-name-input" type="text" placeholder="名前を入力..." maxlength="20" ' +
        'style="width:100%;background:#111;border:1px solid #34c759;border-radius:12px;padding:12px 16px;color:#fff;font-size:1rem;outline:none;box-sizing:border-box;text-align:center;margin-bottom:12px;">' +
        '<button onclick="saveFriendName()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#34c759,#30a84e);color:#fff;border:none;font-weight:800;cursor:pointer;font-size:0.95rem;margin-bottom:8px;">決定</button>' +
        '<button onclick="saveFriendName(true)" style="width:100%;padding:10px;border-radius:12px;background:#222;color:#888;border:1px solid #333;font-size:0.85rem;cursor:pointer;">スキップ</button>';
    modal.appendChild(wrapper);
    document.body.appendChild(modal);

    const inp = document.getElementById('friend-name-input');
    if (inp) {
        inp.focus();
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') saveFriendName(); });
    }
}

function saveFriendName(skip) {
    const modal = document.getElementById('friend-name-modal');
    if (!skip) {
        const val = document.getElementById('friend-name-input')?.value.trim() || '';
        _fc.name = val;
        if (val) {
            const exp = new Date(Date.now() + 30*24*60*60*1000).toUTCString();
            document.cookie = 'fc_nm=' + encodeURIComponent(val) + '; expires=' + exp + '; path=/; SameSite=Strict';
        }
    }
    if (modal) modal.remove();
    updateFriendAuthUI(true);
}

function updateFriendAuthUI(loggedIn) {
    const friendBtn = document.getElementById('auth-friend-btn');
    const badge     = document.getElementById('auth-status-badge');

    if (loggedIn) {
        const name  = _fc.name  || '';
        const group = _fc.group || '';

        if (friendBtn) {
            friendBtn.textContent = '🤝 ' + (name || group || 'ログイン中');
            friendBtn.style.background = '#34c759';
            friendBtn.onclick = () => {
                if (confirm('ログアウトしますか？')) {
                    ['fc_auth','fc_gb64','fc_nm'].forEach(k => {
                        document.cookie = k + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    });
                    _fc = { name: '', group: '' };
                    updateFriendAuthUI(false);
                }
            };
        }
        if (badge && !_currentUser) {
            badge.style.display = 'block';
            let txt = '🤝';
            if (name) txt += ' <strong>' + name + '</strong>';
            if (group) txt += ' で <strong>' + group + '</strong>グループにログイン中';
            else txt += ' でログイン中';
            badge.innerHTML = txt;
        }
    } else {
        if (friendBtn) {
            friendBtn.textContent = '🤝 友達コード';
            friendBtn.style.background = 'linear-gradient(135deg,#ff9500,#ff6b00)';
            friendBtn.onclick = () => { document.getElementById('friend-modal').style.display = 'flex'; };
        }
        if (badge && !_currentUser) badge.style.display = 'none';
    }
}


function initFirebase() {
    try {
        if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
            console.warn("Firebase未設定: FIREBASE_CONFIGを自分のプロジェクトの値に書き換えてください");
            document.getElementById('auth-bar').style.display = 'flex';
            document.getElementById('auth-login-btn').style.display = 'none';
            document.getElementById('auth-username').textContent = 'Firebase未設定';
            return;
        }
        _fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
        _fbAuth = firebase.auth();
        _fbDb   = firebase.firestore();

        // ログイン状態を監視
        _fbAuth.onAuthStateChanged(user => {
            _currentUser = user;
            updateAuthUI(user);
            if (user) {
                syncHistoryFromCloud();
                // Redirectログイン後にtui()が準備できてるか保証するため再適用
                try { applyLanguage(); } catch(e) {}
            }
        });

        // Redirectログイン後の結果を受け取る
        _fbAuth.getRedirectResult().then(result => {
            if (result && result.user) {
                // ログイン成功（onAuthStateChangedでも処理されるので特に何もしない）
            }
        }).catch(e => {
            if (e.code) {
                alert('ログインに失敗しました: ' + e.message);
            }
        });

        document.getElementById('auth-bar').style.display = 'flex';
    } catch(e) {
        console.error("Firebase初期化エラー:", e);
    }
}

function updateAuthUI(user) {
    const loginBtn  = document.getElementById('auth-login-btn');
    const logoutBtn = document.getElementById('auth-logout-btn');
    const avatar    = document.getElementById('auth-avatar');
    const username  = document.getElementById('auth-username');
    const badge     = document.getElementById('auth-status-badge');

    if (user) {
        if (loginBtn)  loginBtn.style.display  = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (user.isAnonymous) {
            avatar.style.display = 'none';
            username.textContent = '👤 匿名';
            document.getElementById('auth-sync-status').textContent = '';
            if (badge) { badge.style.display = 'block'; badge.innerHTML = '👤 匿名ログイン中 — データは端末のみ保存（クラウド同期なし）'; }
        } else {
            const providerData = (user.providerData && user.providerData[0]) || {};
            const displayName  = user.displayName
                || providerData.displayName
                || (user.email && user.email.split('@')[0])
                || (providerData.email && providerData.email.split('@')[0])
                || user.uid.slice(0, 8);
            const photoURL = user.photoURL || providerData.photoURL || null;
            if (photoURL) { avatar.src = photoURL; avatar.style.display = 'block'; }
            else { avatar.style.display = 'none'; }
            username.textContent = displayName;
            document.getElementById('auth-sync-status').textContent = tui().synced;
            if (badge) { badge.style.display = 'block'; badge.innerHTML = '🔓 <strong>' + displayName + '</strong> でログイン中 — 履歴がクラウドに同期されます'; }
        }
        document.body.style.paddingTop = '49px';
    } else {
        if (loginBtn)  loginBtn.style.display  = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        avatar.style.display = 'none';
        username.textContent = '';
        document.getElementById('auth-sync-status').textContent = '';
        if (badge) badge.style.display = 'none';
        document.body.style.paddingTop = '0';
    }
}

function _closeAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}

function openLoginModal() {
    const m = document.getElementById('auth-modal');
    if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function openSignUpModal() {
    _closeAuthModal();
    closeEmailLoginModal();
    const m = document.getElementById('signup-modal');
    if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    const e = document.getElementById('signup-error');
    if (e) e.textContent = '';
    const s = document.getElementById('signup-pw-strength');
    if (s) s.innerHTML = '';
}

function closeSignUpModal() {
    const m = document.getElementById('signup-modal');
    if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}

function openEmailLoginModal() {
    _closeAuthModal();
    const m = document.getElementById('email-login-modal');
    if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    const e = document.getElementById('email-login-error');
    if (e) e.textContent = '';
}

function closeEmailLoginModal() {
    const m = document.getElementById('email-login-modal');
    if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}

function _togglePw(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
}

function _checkPwStrength(pw) {
    const el = document.getElementById('signup-pw-strength');
    if (!el) return;
    if (!pw) { el.innerHTML = ''; return; }
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
        { label: '弱い',    color: '#ff3b30', w: '30%' },
        { label: 'やや弱い', color: '#ff9500', w: '50%' },
        { label: '普通',    color: '#ffcc00', w: '65%' },
        { label: '強い',    color: '#34c759', w: '85%' },
        { label: 'とても強い', color: '#30d158', w: '100%' },
    ];
    const lv = levels[Math.min(score, 4)];
    el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:4px;background:#2a2a2a;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${lv.w};background:${lv.color};border-radius:2px;transition:width 0.3s,background 0.3s;"></div>
        </div>
        <span style="color:${lv.color};font-size:0.75rem;font-weight:700;white-space:nowrap;">${lv.label}</span>
    </div>`;
}

async function submitSignUp() {
    const name  = (document.getElementById('signup-name')?.value    || '').trim();
    const email = (document.getElementById('signup-email')?.value   || '').trim();
    const pw    =  document.getElementById('signup-password')?.value || '';
    const pw2   =  document.getElementById('signup-password2')?.value|| '';
    const errEl =  document.getElementById('signup-error');
    const btn   =  document.getElementById('signup-submit');

    if (errEl) errEl.textContent = '';
    if (!email)       { if (errEl) errEl.textContent = 'メールアドレスを入力してください'; return; }
    if (!pw)          { if (errEl) errEl.textContent = 'パスワードを入力してください'; return; }
    if (pw.length < 6){ if (errEl) errEl.textContent = 'パスワードは6文字以上にしてください'; return; }
    if (pw !== pw2)   { if (errEl) errEl.textContent = 'パスワードが一致しません'; return; }
    if (!_fbAuth)     { if (errEl) errEl.textContent = 'Firebase未設定です'; return; }

    if (btn) { btn.disabled = true; btn.textContent = '作成中...'; }
    try {
        const result = await _fbAuth.createUserWithEmailAndPassword(email, pw);
        if (name) {
            try { await result.user.updateProfile({ displayName: name }); } catch(e2) {}
        }
        closeSignUpModal();
        updateAuthUI(_fbAuth.currentUser);
    } catch(e) {
        const msgs = {
            'auth/email-already-in-use': 'このメールアドレスは既に使われています',
            'auth/invalid-email':        'メールアドレスの形式が正しくありません',
            'auth/weak-password':        'パスワードが短すぎます（6文字以上）',
            'auth/operation-not-allowed':'メール登録が無効です（Firebase設定を確認）',
        };
        if (errEl) errEl.textContent = msgs[e.code] || e.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 アカウントを作成する'; }
    }
}

async function sendPasswordReset() {
    const email = document.getElementById('email-login-email').value.trim();
    const errEl = document.getElementById('email-login-error');
    if (!email) { if (errEl) errEl.textContent = 'メールアドレスを入力してください'; return; }
    if (!_fbAuth) { if (errEl) errEl.textContent = 'Firebase未設定です'; return; }
    try {
        await _fbAuth.sendPasswordResetEmail(email);
        alert('パスワードリセットメールを送信しました！\nメールをご確認ください。');
        if (errEl) errEl.textContent = '';
    } catch(e) {
        const msgs = {
            'auth/user-not-found': 'このメールアドレスは登録されていません',
            'auth/invalid-email':  'メールアドレスの形式が正しくありません',
        };
        if (errEl) errEl.textContent = msgs[e.code] || ('エラー: ' + e.message);
    }
}

async function signInWithEmail() {
    const email  = (document.getElementById('email-login-email')?.value    || '').trim();
    const pw     =  document.getElementById('email-login-password')?.value || '';
    const errEl  =  document.getElementById('email-login-error');
    if (!email || !pw) { if (errEl) errEl.textContent = 'メールとパスワードを入力してください'; return; }
    if (!_fbAuth)      { if (errEl) errEl.textContent = 'Firebase未設定です'; return; }
    try {
        await _fbAuth.signInWithEmailAndPassword(email, pw);
        closeEmailLoginModal();
    } catch(e) {
        const msgs = {
            'auth/user-not-found':   'このメールアドレスは登録されていません',
            'auth/wrong-password':   'パスワードが違います',
            'auth/invalid-email':    'メールアドレスの形式が正しくありません',
            'auth/too-many-requests':'しばらく待ってから再試行してください',
            'auth/invalid-credential': 'メールアドレスまたはパスワードが違います',
        };
        if (errEl) errEl.textContent = msgs[e.code] || e.message;
    }
}

// ══════════════════════════════════════════════════════════════
// 👤 Firebase Authentication (ログイン処理)
// ══════════════════════════════════════════════════════════════
let _isAuthProcessing = false;

async function signInWithGoogle() {
    if (!_fbAuth || _isAuthProcessing) return;
    _isAuthProcessing = true;
    _closeAuthModal();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await _fbAuth.signInWithPopup(provider);
    } catch(e) {
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            alert("Googleログイン失敗: " + e.message);
        }
    } finally { _isAuthProcessing = false; }
}

async function signInWithGitHub() {
    if (!_fbAuth || _isAuthProcessing) return;
    _isAuthProcessing = true;
    _closeAuthModal();
    try {
        const provider = new firebase.auth.GithubAuthProvider();
        provider.addScope('read:user');
        const result = await _fbAuth.signInWithPopup(provider);
        const user = result.user;
        const profile = result.additionalUserInfo && result.additionalUserInfo.profile;
        const ghName = profile && (profile.name || profile.login);
        const ghAvatar = profile && profile.avatar_url;
        if ((ghName && !user.displayName) || (ghAvatar && !user.photoURL)) {
            try { await user.updateProfile({ displayName: user.displayName || ghName || null, photoURL: user.photoURL || ghAvatar || null }); } catch(e2) {}
            updateAuthUI(_fbAuth.currentUser);
        }
    } catch(e) {
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            alert("GitHubログイン失敗: " + e.message);
        }
    } finally { _isAuthProcessing = false; }
}

async function signInWithTwitter() {
    if (!_fbAuth || _isAuthProcessing) return;
    _isAuthProcessing = true;
    _closeAuthModal();
    try {
        const provider = new firebase.auth.TwitterAuthProvider();
        await _fbAuth.signInWithPopup(provider);
    } catch(e) {
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            alert("Twitterログイン失敗: " + e.message);
        }
    } finally { _isAuthProcessing = false; }
}



async function signInWithDiscord() {
    if (!_fbAuth || _isAuthProcessing) return;
    _isAuthProcessing = true;
    _closeAuthModal();
    try {
        const provider = new firebase.auth.OAuthProvider('oidc.podcast.discord');
        await _fbAuth.signInWithPopup(provider);
    } catch(e) {
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            alert("Discordログイン失敗: " + e.message);
        }
    } finally { _isAuthProcessing = false; }
}

async function signInAnonymously_app() {
    if (!_fbAuth || _isAuthProcessing) return;
    _isAuthProcessing = true;
    _closeAuthModal();
    try {
        await _fbAuth.signInAnonymously();
    } catch(e) {
        alert("匿名ログイン失敗: " + e.message);
    } finally { _isAuthProcessing = false; }
}

function signOut() {
    if (_fbAuth) _fbAuth.signOut();
}

// ── Firestore 履歴同期 ──────────────────────────────────────
async function syncHistoryToCloud(history) {
    if (!_currentUser || !_fbDb || _currentUser.isAnonymous) return;
    try {
        await _fbDb.collection('users').doc(_currentUser.uid)
            .collection('diagnosis_history').doc('data')
            .set({ history, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('auth-sync-status').textContent = tui().syncOk;
    } catch(e) {
        document.getElementById('auth-sync-status').textContent = tui().syncFail;
    }
}

async function syncHistoryFromCloud() {
    if (!_currentUser || !_fbDb || _currentUser.isAnonymous) return;
    try {
        document.getElementById('auth-sync-status').textContent = tui().syncing;
        const doc = await _fbDb.collection('users').doc(_currentUser.uid)
            .collection('diagnosis_history').doc('data').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.history && Array.isArray(data.history)) {
                localStorage.setItem('diag_history', JSON.stringify(data.history));
                document.getElementById('auth-sync-status').textContent = tui().syncOk;
            }
        } else {
            // クラウドにデータなし → ローカルをクラウドに上げる
            const local = JSON.parse(localStorage.getItem('diag_history') || '[]');
            if (local.length > 0) await syncHistoryToCloud(local);
            document.getElementById('auth-sync-status').textContent = tui().syncOk;
        }
    } catch(e) {
        document.getElementById('auth-sync-status').textContent = tui().syncFail;
    }
}

function requireLogin(featureName, callback) {
    if (_currentUser) { callback(); return; }
    const msg = document.getElementById('auth-modal-msg');
    msg.textContent = featureName + tui().loginMsg;
    document.getElementById('auth-modal').style.display = 'flex';
}

// ── AI会話のクラウド保存 ──────────────────────────────────────
async function syncAIConvsToCloud(convs) {
    if (!_currentUser || !_fbDb || _currentUser.isAnonymous) return;
    try {
        await _fbDb.collection('users').doc(_currentUser.uid)
            .collection('ai_conversations').doc('data')
            .set({ convs, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch(e) {}
}

async function syncAIConvsFromCloud() {
    if (!_currentUser || !_fbDb || _currentUser.isAnonymous) return;
    try {
        const doc = await _fbDb.collection('users').doc(_currentUser.uid)
            .collection('ai_conversations').doc('data').get();
        if (doc.exists && doc.data().convs) {
            localStorage.setItem('ai_conversations', JSON.stringify(doc.data().convs));
        }
    } catch(e) {}
}

document.addEventListener('keydown', e => {
    if (document.activeElement === document.getElementById('ai-input') && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); sendAIMessage();
    }
});
window.addEventListener('load',()=>{
    // ページ読み込み時は必ず最上部へ（ブラウザのスクロール位置保持を無効化）
    history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, behavior: 'instant' });
    // 設定読み込み・適用（エラーが起きても診断は必ず実行）
    try { loadSettings(); } catch(e) { console.warn('loadSettings error:', e); }
    try { applySettings(); } catch(e) { console.warn('applySettings error:', e); }

    // URLに対戦パラメータがあれば保持
    _checkBattleURL();

    document.getElementById('b-ua').textContent = navigator.userAgent;
    document.getElementById('dl-btn').addEventListener('click', downloadCapturedImage);
    initFirebase();
    // 友達コードのCookieチェック
    if (checkFriendCookie()) { loadFriendFromCookie(); updateFriendAuthUI(true); }
    // Enterキーで友達コード送信
    document.getElementById('friend-code-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') checkFriendCode();
    });

    // ── フローティング設定ボタン ──
    const fab = document.createElement('button');
    fab.id = 'settings-fab';
    fab.textContent = '⚙️';
    fab.onclick = openSettings;
    fab.style.cssText = 'position:fixed;bottom:80px;right:16px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3a3a3c,#2a2a2a);border:1px solid #444;color:#fff;font-size:1.3rem;cursor:pointer;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;touch-action:manipulation;';
    document.body.appendChild(fab);

    // 診断は必ず実行（設定エラーに関わらず）
    runBenchmark();

    // 通知許可：desktopNotifyがONかつ未許可なら起動後3秒後に理由説明→要求
    if (_settings.desktopNotify && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        setTimeout(() => {
            const ui = tui();
            const reason = ui.notifyPromptReason || '診断完了時にデスクトップ通知でお知らせします。通知を許可しますか？';
            if (confirm(reason)) {
                Notification.requestPermission().then(p => {
                    if (p !== 'granted') {
                        _settings.desktopNotify = false;
                        saveSettings();
                    }
                });
            } else {
                _settings.desktopNotify = false;
                saveSettings();
            }
        }, 3000);
    }

    // バッジクリア（起動時・フォーカス時・タブ表示時の全イベントで確実に消す）
    try { clearBadge(); } catch(e) {}
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') { try { clearBadge(); } catch(e) {} }
    });
    window.addEventListener('focus', () => { try { clearBadge(); } catch(e) {} });
    window.addEventListener('pageshow', () => { try { clearBadge(); } catch(e) {} });
});

function initHelpIcons() {
    document.querySelectorAll('.label').forEach(el => {
        if (el.querySelector('.help')) return;

        const help = document.createElement('span');
        help.className = 'help';
        help.textContent = '＊';

        const text = el.textContent;

        if (text.includes('CPU')) help.dataset.key = 'cpu';
        else if (text.includes('メモリ')) help.dataset.key = 'ram';
        else if (text.includes('GPU')) help.dataset.key = 'gpu';
        else if (text.includes('フレーム') || text.includes('FPS')) help.dataset.key = 'fps';
        else if (text.includes('画面') || text.includes('解像度')) help.dataset.key = 'display';
        else if (text.includes('ネットワーク') || text.includes('回線')) help.dataset.key = 'network';
        else if (text.includes('バッテリー')) help.dataset.key = 'battery';
        else help.dataset.key = 'other';

        el.appendChild(help);
    });
}

// ── 診断項目の説明文（行番号1〜34対応・全11言語）──
// ── 設定項目の＊説明文（多言語）──
const SETTING_HELP_I18N = {
    'ja': {
        theme:        'アプリの配色を変更します。\n・ダーク：黒背景（デフォルト）\n・ライト：白背景\n・システム：OSの設定に自動追従\n📱 夜間はダーク推奨。',
        fontSize:     'テキストの大きさを変更します。\n・小：13px / 普通：15px / 大：20px / カスタム：自由設定\n📱 見づらい場合は「大」かカスタムがおすすめです。',
        language:     '表示言語を切り替えます。選択すると即座に反映されます。\n⚠️ ボタン・診断項目・設定などが翻訳されます。',
        translateGuard:'Google翻訳拡張でレイアウトが崩れるのを防ぎます。\nONにするとGoogle翻訳が無効になります。\n💻 PCのChrome拡張がある場合はON推奨。',
        soundOnDone:  '診断完了時にチャイム音を鳴らします。\n⚠️ サイレントモード中は鳴りません。\n📱 スマートフォン・💻 PC どちらでも動作。',
        vibration:    '診断完了時に端末を振動させます。\n📱 スマートフォンのみ対応。PCでは動作しません。\n⚠️ iOS Safariでは動作しない場合があります。',
        desktopNotify:'診断完了時にブラウザ通知を表示します。\n初回ONで許可ダイアログが表示されます。\n😴 お休み時間中は通知されません。\n💻 PC推奨。スマートフォンはPWA状態で安定。',
        badge:        'PWAのアイコンにバッジを表示します。\n📱 Android PWAのみ対応。\n❌ iOSは非対応。',
        quietStart:   'この時刻からお休み時間開始。\nデスクトップ通知を送りません。\nデフォルト：22:00',
        quietEnd:     'お休み時間の終了時刻。\n開始より早い時刻で日をまたいで適用。\nデフォルト：6:40',
        exportFormat: '診断レポートの保存形式。\n・PNG：画像（デフォルト・SNS向け）\n・CSV：表計算ソフト（Excel等）用\n・PDF：印刷用HTMLをPDFとして保存',
        speedUnit:    '通信速度の表示単位。\n・Mbps：一般的な単位（デフォルト）\n・MB/s：Mbpsの約1/8\n例：100Mbps ≒ 12.5MB/s',
        autoCheck:    'ページを開いたとき自動的に診断を開始します。',
        clumsiGuard:  '再診断ボタンを押したとき確認ダイアログを表示。\n誤タップによるリセットを防げます。\n⚠️ OFFにすると確認なしで即座に再診断。',
        fontFamily:   'フォントの種類を変更します。\nChromeなら端末にインストールされているフォントも選択できます（許可が必要）。',
        fontFamily:   'アプリ全体のフォントを変更します。\nプリセット5種類から選択できます。\n📱 端末にインストール済みのフォントも選択できます（Chrome対応・要許可）。',
    },
    'en': {
        theme:        'Change the app color scheme.\n・Dark: Black background (default)\n・Light: White background\n・System: Follows OS setting',
        fontSize:     'Change text size.\n・Small: 13px / Normal: 15px / Large: 20px / Custom: free input\n📱 Use Large or Custom if text is hard to read.',
        language:     'Switch display language. Changes apply instantly.\n⚠️ Buttons, labels, and settings will be translated.',
        translateGuard:'Prevents Google Translate extension from breaking the layout.\nON disables Google Translate.\n💻 Recommended ON if you have Chrome extension.',
        soundOnDone:  'Play a chime when diagnosis completes.\n⚠️ Silent mode will mute it.\n📱 Works on both mobile and PC.',
        vibration:    'Vibrate device when diagnosis completes.\n📱 Mobile only. Does not work on PC.\n⚠️ May not work on iOS Safari.',
        desktopNotify:'Show browser notification when diagnosis completes.\nPermission dialog appears on first enable.\n😴 No notification during quiet hours.',
        badge:        'Show badge on app icon.\n📱 Android PWA only.\n❌ iOS not supported.',
        quietStart:   'Quiet hours start time. No desktop notifications during this period. Default: 22:00',
        quietEnd:     'Quiet hours end time. Set earlier than start to span midnight. Default: 6:40',
        exportFormat: 'Report export format.\n・PNG: Image (default, best for sharing)\n・CSV: Spreadsheet (Excel etc.)\n・PDF: Save as PDF via print dialog',
        speedUnit:    'Network speed display unit.\n・Mbps: Common unit (default)\n・MB/s: ~1/8 of Mbps\nExample: 100Mbps ≈ 12.5MB/s',
        autoCheck:    'Automatically start diagnosis when page opens.',
        clumsiGuard:  'Show confirmation dialog before re-diagnosing.\nPrevents accidental resets.\n⚠️ OFF means immediate re-diagnosis without confirmation.',
        fontFamily:   'Change the font style.\nOn Chrome, you can also pick fonts installed on your device (permission required).',
        fontFamily:   'Change the font for the entire app.\nChoose from 5 presets.\n📱 Local device fonts also available (Chrome, requires permission).',
    },
};
// 他言語はjaにフォールバック（SETTING_HELP_I18N[lang] || SETTING_HELP_I18N['ja']）

// ══════════════════════════════════════════════════════════════
// 📋 利用規約（11言語対応）
// ══════════════════════════════════════════════════════════════
const TERMS_I18N = {
    'ja': {
        title: '📋 利用規約',
        footer: '利用規約',
        close: '閉じる',
        body: `<h3 style="color:#fff;margin:0 0 12px;">精密デバイス診断 Pro Ultra 利用規約</h3>
<p>本ウェブアプリ（以下「本サービス」）をご利用いただく前に、以下の利用規約をよくお読みください。本サービスを利用した時点で、本規約に同意したものとみなします。</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. 推奨環境</h4>
<p>推奨ブラウザは <strong style="color:#34c759;">Google Chrome</strong> です。<br>Safari（特にiOS Safari）では、一部機能（音声・通知・WebGL等）が正常に動作しない場合があります。Safari以外のブラウザの使用を推奨します。</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. 取得情報について</h4>
<p>本サービスは、診断のためにデバイスのハードウェア情報・ブラウザ情報・IPアドレス等を取得します。これらの情報はすべてブラウザ内のみで処理され、当サービスのサーバーには送信されません。ただし、IP取得のため外部API（ipify.org）への通信が発生します。</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. IPアドレスの取り扱い</h4>
<p>本サービスでは、WebRTCおよび外部APIを通じてIPアドレスを取得・表示します。<strong style="color:#ff9500;">スクリーンショットにIPアドレスを含めてSNS等に公開した場合、おおよその居住地域や利用プロバイダが特定される危険があります。</strong><br>これにより損害が生じた場合でも、<strong style="color:#ff6b6b;">本ウェブアプリおよびその開発者は一切の責任を負いません。</strong>IPアドレスの公開には十分ご注意ください。</p>

<h4 style="color:#eee;margin:16px 0 6px;">4. 診断結果の正確性</h4>
<p>本サービスの診断結果はブラウザAPIから取得した推定値であり、実際のハードウェアスペックと異なる場合があります。診断結果の正確性を保証するものではありません。</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. 免責事項</h4>
<p>本サービスの利用により生じた損害（データ損失・プライバシー侵害・機器の不具合等）について、開発者は一切の責任を負いません。自己責任のもとでご利用ください。</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. 規約の変更について</h4>
<p>気が向いたり、何か理由があれば規約が変わることがあります。でも大きな変更のときはアップデート情報でちゃんとお知らせするので安心してください。変更後も使い続けてくれたら「了解～」ってことにさせてください🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">最終更新：_TERMS_DATE_ | 精密デバイス診断 Pro Ultra Beta 1.6.0</p>`
    },
    'ja-hira': {
        title: '📋 りようきやく',
        footer: 'りようきやく',
        close: 'とじる',
        body: `<h3 style="color:#fff;margin:0 0 12px;">せいみつでばいすしんだん Pro Ultra りようきやく</h3>
<p>このあぷりをつかうまえに、よくよんでください。つかったじてんで、どういしたとみなします。</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. すいしょうかんきょう</h4>
<p>すいしょうぶらうざは <strong style="color:#34c759;">Google Chrome</strong> です。<br>Safari（とくにiOS Safari）では、いちぶのきのうがただしくうごかないことがあります。</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. とりあつかうじょうほう</h4>
<p>このあぷりは、でばいすのじょうほうやIPあどれすをしゅとくします。これらはぶらうざないだけでしょりされ、さーばーにはそうしんされません。</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. IPあどれすについて</h4>
<p>すくりーんしょっとにIPあどれすをふくめてこうかいすると、すんでいるばしょがわかるかもしれません。<strong style="color:#ff6b6b;">このあぷりはそのせきにんをおいません。</strong></p>

<h4 style="color:#eee;margin:16px 0 6px;">4. しんだんけっかについて</h4>
<p>しんだんけっかはすいていちです。じっさいのすぺっくとちがうことがあります。</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. めんせきじこう</h4>
<p>このあぷりをつかってしょうじたそんがいについて、かいはつしゃはせきにんをおいません。</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. きやくのへんこう</h4>
<p>このきやくは、よこくなくかわることがあります。かわったあとにこのあぷりをつかうと、あたらしいきやくにどういしたとみなします。おおきなへんこうのときはあぷでとじょうほうでおしらせします。</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Pro Ultra Beta 1.6.0</p>`
    },
    'en': {
        title: '📋 Terms of Use',
        footer: 'Terms of Use',
        close: 'Close',
        body: `<h3 style="color:#fff;margin:0 0 12px;">Precise Device Diagnostics Pro Ultra — Terms of Use</h3>
<p>Please read these Terms of Use carefully before using this web application (the "Service"). By using the Service, you agree to be bound by these terms.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. Recommended Environment</h4>
<p>The recommended browser is <strong style="color:#34c759;">Google Chrome</strong>.<br>Some features (audio, notifications, WebGL, etc.) may not function correctly in Safari, especially iOS Safari. We recommend using a non-Safari browser.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. Information Collected</h4>
<p>The Service collects device hardware information, browser information, and IP addresses for diagnostic purposes. All data is processed locally in your browser and is never sent to our servers. However, an external API (ipify.org) is used to obtain your public IP address.</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. IP Address Handling</h4>
<p>This Service retrieves and displays your IP address via WebRTC and external APIs. <strong style="color:#ff9500;">If you share a screenshot containing your IP address on social media or other public platforms, your approximate location and ISP may be identifiable.</strong><br><strong style="color:#ff6b6b;">The developer of this application accepts no responsibility for any damages arising from such disclosure.</strong> Please exercise caution when sharing your IP address.</p>

<h4 style="color:#eee;margin:16px 0 6px;">4. Accuracy of Results</h4>
<p>Diagnostic results are estimates derived from browser APIs and may differ from actual hardware specifications. We do not guarantee the accuracy of any diagnostic results.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. Disclaimer</h4>
<p>The developer accepts no liability for any damages (including data loss, privacy breaches, or device issues) arising from the use of this Service. Use at your own risk.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. Changes to Terms</h4>
<p>We might update these terms occasionally if needed. If anything major changes, we'll let you know through the in-app update info. Continuing to use the app after that means you're cool with it 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Last updated: _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'zh-hans': {
        title: '📋 使用条款',
        footer: '使用条款',
        close: '关闭',
        body: `<h3 style="color:#fff;margin:0 0 12px;">精密设备诊断 Pro Ultra 使用条款</h3>
<p>在使用本网络应用（以下简称"本服务"）之前，请仔细阅读以下使用条款。使用本服务即表示您同意本条款。</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. 推荐环境</h4>
<p>推荐使用 <strong style="color:#34c759;">Google Chrome</strong> 浏览器。<br>Safari（尤其是 iOS Safari）可能无法正常使用部分功能（音频、通知、WebGL等）。建议使用非Safari浏览器。</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. 收集的信息</h4>
<p>本服务为诊断目的收集设备硬件信息、浏览器信息及IP地址。所有数据均在您的浏览器本地处理，不会发送至我们的服务器。但会使用外部API（ipify.org）获取您的公网IP地址。</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. IP地址处理</h4>
<p>本服务通过WebRTC和外部API获取并显示您的IP地址。<strong style="color:#ff9500;">如果您将含有IP地址的截图发布到社交媒体等公开平台，可能导致您的大致位置和ISP被识别。</strong><br><strong style="color:#ff6b6b;">因此造成的任何损害，本应用及其开发者概不负责。</strong>请谨慎处理您的IP地址信息。</p>

<h4 style="color:#eee;margin:16px 0 6px;">4. 诊断结果的准确性</h4>
<p>诊断结果是从浏览器API获取的估算值，可能与实际硬件规格有所不同。我们不保证诊断结果的准确性。</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. 免责声明</h4>
<p>因使用本服务而产生的任何损害（包括数据丢失、隐私泄露或设备问题），开发者不承担任何责任。请自行承担使用风险。</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. 条款变更</h4>
<p>如果需要，我们可能会偶尔更新这些条款。有重大变更时，我们会在应用内的更新信息中告知您。继续使用即表示您接受变更 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">最后更新：2026年3月 | Pro Ultra Beta 1.6.0</p>`
    },
    'zh-hant': {
        title: '📋 使用條款',
        footer: '使用條款',
        close: '關閉',
        body: `<h3 style="color:#fff;margin:0 0 12px;">精密裝置診斷 Pro Ultra 使用條款</h3>
<p>在使用本網路應用程式（以下簡稱「本服務」）之前，請仔細閱讀以下使用條款。使用本服務即表示您同意本條款。</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. 推薦環境</h4>
<p>推薦使用 <strong style="color:#34c759;">Google Chrome</strong> 瀏覽器。<br>Safari（尤其是 iOS Safari）可能無法正常使用部分功能（音訊、通知、WebGL等）。建議使用非Safari瀏覽器。</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. 收集的資訊</h4>
<p>本服務為診斷目的收集裝置硬體資訊、瀏覽器資訊及IP位址。所有資料均在您的瀏覽器本機處理，不會傳送至我們的伺服器。但會使用外部API（ipify.org）取得您的公網IP位址。</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. IP位址處理</h4>
<p>本服務透過WebRTC和外部API取得並顯示您的IP位址。<strong style="color:#ff9500;">若您將含有IP位址的截圖發布至社群媒體等公開平台，可能導致您的大致位置和ISP被識別。</strong><br><strong style="color:#ff6b6b;">因此造成的任何損害，本應用程式及其開發者概不負責。</strong>請謹慎處理您的IP位址資訊。</p>

<h4 style="color:#eee;margin:16px 0 6px;">4. 診斷結果的準確性</h4>
<p>診斷結果是從瀏覽器API取得的估算值，可能與實際硬體規格有所不同。我們不保證診斷結果的準確性。</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. 免責聲明</h4>
<p>因使用本服務而產生的任何損害（包括資料遺失、隱私洩露或裝置問題），開發者不承擔任何責任。請自行承擔使用風險。</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. 條款變更</h4>
<p>如有需要，我們可能會偶爾更新這些條款。有重大變更時，我們會在應用程式內的更新資訊中告知您。繼續使用即表示您接受變更 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">最後更新：_TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'ko': {
        title: '📋 이용약관',
        footer: '이용약관',
        close: '닫기',
        body: `<h3 style="color:#fff;margin:0 0 12px;">정밀 기기 진단 Pro Ultra 이용약관</h3>
<p>이 웹 애플리케이션(이하 "본 서비스")을 이용하시기 전에 아래 이용약관을 주의 깊게 읽어주세요. 본 서비스를 이용하면 본 약관에 동의한 것으로 간주합니다.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. 권장 환경</h4>
<p>권장 브라우저는 <strong style="color:#34c759;">Google Chrome</strong>입니다.<br>Safari(특히 iOS Safari)에서는 일부 기능(오디오, 알림, WebGL 등)이 정상적으로 작동하지 않을 수 있습니다. Safari 이외의 브라우저 사용을 권장합니다.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. 수집 정보</h4>
<p>본 서비스는 진단 목적으로 기기 하드웨어 정보, 브라우저 정보 및 IP 주소를 수집합니다. 모든 데이터는 브라우저 내에서만 처리되며 서버로 전송되지 않습니다. 단, 외부 API(ipify.org)를 통해 공인 IP 주소를 가져옵니다.</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. IP 주소 처리</h4>
<p>본 서비스는 WebRTC 및 외부 API를 통해 IP 주소를 가져와 표시합니다. <strong style="color:#ff9500;">IP 주소가 포함된 스크린샷을 SNS 등 공개 플랫폼에 공유하면 대략적인 위치와 ISP가 식별될 수 있습니다.</strong><br><strong style="color:#ff6b6b;">이로 인해 발생한 모든 손해에 대해 본 애플리케이션 및 개발자는 일절 책임지지 않습니다.</strong> IP 주소 공개에 충분히 주의하세요.</p>

<h4 style="color:#eee;margin:16px 0 6px;">4. 진단 결과의 정확성</h4>
<p>진단 결과는 브라우저 API에서 얻은 추정값이며 실제 하드웨어 사양과 다를 수 있습니다. 진단 결과의 정확성을 보장하지 않습니다.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. 면책 사항</h4>
<p>본 서비스 이용으로 발생한 모든 손해(데이터 손실, 개인정보 침해, 기기 문제 등)에 대해 개발자는 일절 책임지지 않습니다. 자신의 책임 하에 이용하세요.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. 약관 변경</h4>
<p>필요에 따라 약관이 변경될 수 있어요. 중요한 변경이 있을 때는 앱 내 업데이트 정보로 알려드릴게요. 계속 사용하시면 변경에 동의하신 것으로 볼게요 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">최종 업데이트: _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'vi': {
        title: '📋 Điều khoản sử dụng',
        footer: 'Điều khoản',
        close: 'Đóng',
        body: `<h3 style="color:#fff;margin:0 0 12px;">Chẩn đoán thiết bị chính xác Pro Ultra — Điều khoản sử dụng</h3>
<p>Vui lòng đọc kỹ Điều khoản sử dụng này trước khi sử dụng ứng dụng web (sau đây gọi là "Dịch vụ"). Bằng cách sử dụng Dịch vụ, bạn đồng ý với các điều khoản này.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. Môi trường khuyến nghị</h4>
<p>Trình duyệt được khuyến nghị là <strong style="color:#34c759;">Google Chrome</strong>.<br>Một số tính năng (âm thanh, thông báo, WebGL, v.v.) có thể không hoạt động đúng trên Safari, đặc biệt là iOS Safari.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. Thông tin thu thập</h4>
<p>Dịch vụ thu thập thông tin phần cứng thiết bị, thông tin trình duyệt và địa chỉ IP cho mục đích chẩn đoán. Tất cả dữ liệu được xử lý cục bộ trong trình duyệt của bạn và không bao giờ được gửi đến máy chủ của chúng tôi. Tuy nhiên, API bên ngoài (ipify.org) được sử dụng để lấy địa chỉ IP công cộng của bạn.</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. Xử lý địa chỉ IP</h4>
<p>Dịch vụ này lấy và hiển thị địa chỉ IP của bạn qua WebRTC và API bên ngoài. <strong style="color:#ff9500;">Nếu bạn chia sẻ ảnh chụp màn hình chứa địa chỉ IP lên mạng xã hội hoặc các nền tảng công khai khác, vị trí gần đúng và ISP của bạn có thể bị xác định.</strong><br><strong style="color:#ff6b6b;">Nhà phát triển ứng dụng này không chịu trách nhiệm về bất kỳ thiệt hại nào phát sinh từ việc tiết lộ đó.</strong></p>

<h4 style="color:#eee;margin:16px 0 6px;">4. Độ chính xác của kết quả</h4>
<p>Kết quả chẩn đoán là ước tính từ API trình duyệt và có thể khác với thông số phần cứng thực tế. Chúng tôi không đảm bảo độ chính xác của bất kỳ kết quả chẩn đoán nào.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. Miễn trách nhiệm</h4>
<p>Nhà phát triển không chịu trách nhiệm về bất kỳ thiệt hại nào phát sinh từ việc sử dụng Dịch vụ này. Sử dụng theo rủi ro của bạn.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. Thay đổi điều khoản</h4>
<p>Chúng tôi có thể cập nhật điều khoản khi cần. Nếu có thay đổi lớn, chúng tôi sẽ thông báo qua mục cập nhật trong ứng dụng. Tiếp tục sử dụng có nghĩa là bạn đồng ý với thay đổi 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Cập nhật lần cuối: _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'es': {
        title: '📋 Términos de uso',
        footer: 'Términos',
        close: 'Cerrar',
        body: `<h3 style="color:#fff;margin:0 0 12px;">Diagnóstico de dispositivos Pro Ultra — Términos de uso</h3>
<p>Lea detenidamente estos Términos de uso antes de utilizar esta aplicación web (el "Servicio"). Al utilizar el Servicio, acepta estar sujeto a estos términos.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. Entorno recomendado</h4>
<p>El navegador recomendado es <strong style="color:#34c759;">Google Chrome</strong>.<br>Algunas funciones (audio, notificaciones, WebGL, etc.) pueden no funcionar correctamente en Safari, especialmente en iOS Safari. Se recomienda usar un navegador distinto a Safari.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. Información recopilada</h4>
<p>El Servicio recopila información de hardware del dispositivo, información del navegador y direcciones IP con fines de diagnóstico. Todos los datos se procesan localmente en su navegador y nunca se envían a nuestros servidores. Sin embargo, se utiliza una API externa (ipify.org) para obtener su dirección IP pública.</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. Manejo de la dirección IP</h4>
<p>Este Servicio obtiene y muestra su dirección IP mediante WebRTC y APIs externas. <strong style="color:#ff9500;">Si comparte una captura de pantalla que contiene su dirección IP en redes sociales u otras plataformas públicas, su ubicación aproximada y proveedor de internet podrían ser identificados.</strong><br><strong style="color:#ff6b6b;">El desarrollador de esta aplicación no acepta ninguna responsabilidad por los daños derivados de dicha divulgación.</strong></p>

<h4 style="color:#eee;margin:16px 0 6px;">4. Precisión de los resultados</h4>
<p>Los resultados del diagnóstico son estimaciones derivadas de las APIs del navegador y pueden diferir de las especificaciones reales del hardware. No garantizamos la precisión de ningún resultado de diagnóstico.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. Exención de responsabilidad</h4>
<p>El desarrollador no acepta ninguna responsabilidad por los daños (incluyendo pérdida de datos, violaciones de privacidad o problemas con dispositivos) derivados del uso de este Servicio. Úselo bajo su propio riesgo.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. Cambios en los términos</h4>
<p>Podemos actualizar estos términos de vez en cuando si es necesario. Si hay cambios importantes, te avisaremos en la info de actualización de la app. Seguir usando la app significa que estás de acuerdo 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Última actualización: _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'pt': {
        title: '📋 Termos de uso',
        footer: 'Termos',
        close: 'Fechar',
        body: `<h3 style="color:#fff;margin:0 0 12px;">Diagnóstico de dispositivos Pro Ultra — Termos de uso</h3>
<p>Leia atentamente estes Termos de uso antes de utilizar este aplicativo web (o "Serviço"). Ao utilizar o Serviço, você concorda em estar vinculado a estes termos.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. Ambiente recomendado</h4>
<p>O navegador recomendado é o <strong style="color:#34c759;">Google Chrome</strong>.<br>Alguns recursos (áudio, notificações, WebGL, etc.) podem não funcionar corretamente no Safari, especialmente no iOS Safari. Recomendamos usar um navegador diferente do Safari.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. Informações coletadas</h4>
<p>O Serviço coleta informações de hardware do dispositivo, informações do navegador e endereços IP para fins de diagnóstico. Todos os dados são processados localmente no seu navegador e nunca são enviados aos nossos servidores. No entanto, uma API externa (ipify.org) é usada para obter seu endereço IP público.</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. Tratamento do endereço IP</h4>
<p>Este Serviço obtém e exibe seu endereço IP via WebRTC e APIs externas. <strong style="color:#ff9500;">Se você compartilhar uma captura de tela contendo seu endereço IP em redes sociais ou outras plataformas públicas, sua localização aproximada e ISP podem ser identificados.</strong><br><strong style="color:#ff6b6b;">O desenvolvedor deste aplicativo não aceita nenhuma responsabilidade por danos decorrentes dessa divulgação.</strong></p>

<h4 style="color:#eee;margin:16px 0 6px;">4. Precisão dos resultados</h4>
<p>Os resultados do diagnóstico são estimativas derivadas das APIs do navegador e podem diferir das especificações reais do hardware. Não garantimos a precisão de nenhum resultado de diagnóstico.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. Isenção de responsabilidade</h4>
<p>O desenvolvedor não aceita nenhuma responsabilidade por danos (incluindo perda de dados, violações de privacidade ou problemas com dispositivos) decorrentes do uso deste Serviço. Use por sua conta e risco.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. Alterações nos termos</h4>
<p>Podemos atualizar estes termos de vez em quando, se necessário. Se houver mudanças importantes, avisaremos nas informações de atualização do app. Continuar usando significa que você concorda 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Última atualização: _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'fr': {
        title: '📋 Conditions d\'utilisation',
        footer: 'Conditions',
        close: 'Fermer',
        body: `<h3 style="color:#fff;margin:0 0 12px;">Diagnostic précis d'appareil Pro Ultra — Conditions d'utilisation</h3>
<p>Veuillez lire attentivement ces Conditions d'utilisation avant d'utiliser cette application web (le « Service »). En utilisant le Service, vous acceptez d'être lié par ces conditions.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. Environnement recommandé</h4>
<p>Le navigateur recommandé est <strong style="color:#34c759;">Google Chrome</strong>.<br>Certaines fonctionnalités (audio, notifications, WebGL, etc.) peuvent ne pas fonctionner correctement sur Safari, en particulier iOS Safari. Nous recommandons d'utiliser un navigateur autre que Safari.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. Informations collectées</h4>
<p>Le Service collecte des informations sur le matériel de l'appareil, des informations sur le navigateur et des adresses IP à des fins de diagnostic. Toutes les données sont traitées localement dans votre navigateur et ne sont jamais envoyées à nos serveurs. Cependant, une API externe (ipify.org) est utilisée pour obtenir votre adresse IP publique.</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. Traitement de l'adresse IP</h4>
<p>Ce Service obtient et affiche votre adresse IP via WebRTC et des APIs externes. <strong style="color:#ff9500;">Si vous partagez une capture d'écran contenant votre adresse IP sur les réseaux sociaux ou d'autres plateformes publiques, votre emplacement approximatif et votre FAI pourraient être identifiés.</strong><br><strong style="color:#ff6b6b;">Le développeur de cette application n'accepte aucune responsabilité pour les dommages résultant d'une telle divulgation.</strong></p>

<h4 style="color:#eee;margin:16px 0 6px;">4. Précision des résultats</h4>
<p>Les résultats du diagnostic sont des estimations dérivées des APIs du navigateur et peuvent différer des spécifications matérielles réelles. Nous ne garantissons pas la précision des résultats de diagnostic.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. Clause de non-responsabilité</h4>
<p>Le développeur n'accepte aucune responsabilité pour les dommages (y compris la perte de données, les violations de la vie privée ou les problèmes d'appareil) résultant de l'utilisation de ce Service. Utilisez à vos propres risques.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. Modifications des conditions</h4>
<p>Nous pouvons mettre à jour ces conditions de temps en temps si nécessaire. En cas de changement important, nous vous en informerons via les infos de mise à jour de l'appli. Continuer à utiliser l'appli signifie que vous êtes d'accord 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Dernière mise à jour : _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'de': {
        title: '📋 Nutzungsbedingungen',
        footer: 'Nutzungsbedingungen',
        close: 'Schließen',
        body: `<h3 style="color:#fff;margin:0 0 12px;">Präzise Gerätediagnose Pro Ultra — Nutzungsbedingungen</h3>
<p>Bitte lesen Sie diese Nutzungsbedingungen sorgfältig durch, bevor Sie diese Webanwendung (den „Dienst") nutzen. Durch die Nutzung des Dienstes stimmen Sie diesen Bedingungen zu.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. Empfohlene Umgebung</h4>
<p>Der empfohlene Browser ist <strong style="color:#34c759;">Google Chrome</strong>.<br>Einige Funktionen (Audio, Benachrichtigungen, WebGL usw.) funktionieren in Safari, insbesondere iOS Safari, möglicherweise nicht korrekt. Wir empfehlen die Verwendung eines Nicht-Safari-Browsers.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. Gesammelte Informationen</h4>
<p>Der Dienst sammelt Gerätehardwareinformationen, Browserinformationen und IP-Adressen für Diagnosezwecke. Alle Daten werden lokal in Ihrem Browser verarbeitet und niemals an unsere Server gesendet. Es wird jedoch eine externe API (ipify.org) verwendet, um Ihre öffentliche IP-Adresse abzurufen.</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. Umgang mit IP-Adressen</h4>
<p>Dieser Dienst ruft Ihre IP-Adresse über WebRTC und externe APIs ab und zeigt sie an. <strong style="color:#ff9500;">Wenn Sie einen Screenshot mit Ihrer IP-Adresse in sozialen Medien oder anderen öffentlichen Plattformen teilen, könnten Ihr ungefährer Standort und Ihr ISP identifiziert werden.</strong><br><strong style="color:#ff6b6b;">Der Entwickler dieser Anwendung übernimmt keine Haftung für Schäden, die durch eine solche Offenlegung entstehen.</strong></p>

<h4 style="color:#eee;margin:16px 0 6px;">4. Genauigkeit der Ergebnisse</h4>
<p>Diagnoseergebnisse sind Schätzungen aus Browser-APIs und können von den tatsächlichen Hardwarespezifikationen abweichen. Wir garantieren nicht die Genauigkeit der Diagnoseergebnisse.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. Haftungsausschluss</h4>
<p>Der Entwickler übernimmt keine Haftung für Schäden (einschließlich Datenverlust, Datenschutzverletzungen oder Geräteprobleme), die durch die Nutzung dieses Dienstes entstehen. Nutzung auf eigene Gefahr.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. Änderungen der Bedingungen</h4>
<p>Wir können diese Bedingungen gelegentlich aktualisieren, wenn nötig. Bei wichtigen Änderungen informieren wir dich über die Update-Infos in der App. Die weitere Nutzung bedeutet, dass du einverstanden bist 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Zuletzt aktualisiert: _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
    'ru': {
        title: '📋 Условия использования',
        footer: 'Условия',
        close: 'Закрыть',
        body: `<h3 style="color:#fff;margin:0 0 12px;">Точная диагностика устройств Pro Ultra — Условия использования</h3>
<p>Пожалуйста, внимательно прочитайте настоящие Условия использования перед использованием данного веб-приложения («Сервис»). Используя Сервис, вы соглашаетесь соблюдать эти условия.</p>

<h4 style="color:#eee;margin:16px 0 6px;">1. Рекомендуемая среда</h4>
<p>Рекомендуемый браузер — <strong style="color:#34c759;">Google Chrome</strong>.<br>Некоторые функции (звук, уведомления, WebGL и др.) могут работать некорректно в Safari, особенно в iOS Safari. Рекомендуем использовать браузер, отличный от Safari.</p>

<h4 style="color:#eee;margin:16px 0 6px;">2. Собираемая информация</h4>
<p>Сервис собирает информацию об аппаратном обеспечении устройства, браузере и IP-адресах в диагностических целях. Все данные обрабатываются локально в вашем браузере и никогда не отправляются на наши серверы. Однако для получения вашего публичного IP-адреса используется внешний API (ipify.org).</p>

<h4 style="color:#eee;margin:16px 0 6px;">3. Обработка IP-адреса</h4>
<p>Данный Сервис получает и отображает ваш IP-адрес через WebRTC и внешние API. <strong style="color:#ff9500;">Если вы поделитесь скриншотом, содержащим ваш IP-адрес, в социальных сетях или других публичных платформах, ваше приблизительное местоположение и провайдер могут быть определены.</strong><br><strong style="color:#ff6b6b;">Разработчик данного приложения не несёт никакой ответственности за ущерб, возникший в результате такого раскрытия информации.</strong></p>

<h4 style="color:#eee;margin:16px 0 6px;">4. Точность результатов</h4>
<p>Результаты диагностики являются оценками, полученными из API браузера, и могут отличаться от фактических характеристик оборудования. Мы не гарантируем точность результатов диагностики.</p>

<h4 style="color:#eee;margin:16px 0 6px;">5. Отказ от ответственности</h4>
<p>Разработчик не несёт ответственности за любой ущерб (включая потерю данных, нарушение конфиденциальности или проблемы с устройствами), возникший в результате использования данного Сервиса. Используйте на свой страх и риск.</p>

<h4 style="color:#eee;margin:16px 0 6px;">6. Изменения условий</h4>
<p>Мы можем иногда обновлять эти условия при необходимости. О важных изменениях сообщим через обновления в приложении. Продолжение использования означает ваше согласие 🙏</p>

<p style="color:#555;font-size:0.8rem;margin-top:20px;">Последнее обновление: _TERMS_DATE_ | Pro Ultra Beta 1.6.0</p>`
    },
};

// ══════════════════════════════════════════════════════════════
// 💬 フィードバック（Formspree）
// ══════════════════════════════════════════════════════════════
const FORMSPREE_ID = 'mojkzbvz';
let _fbDeviceAttach = true;

const FB_I18N = {
    'ja':      { title:'💬 フィードバック', desc:'バグ報告・機能要望など、お気軽にどうぞ。匿名で送信されます。', catLabel:'カテゴリ', bodyLabel:'内容', bodyPlaceholder:'詳しく教えてください...', deviceLabel:'デバイス情報を添付する（ランク・スコア等）', submit:'📨 送信する', sending:'送信中...', success:'✅ 送信しました！ありがとうございます。', error:'❌ 送信に失敗しました。もう一度お試しください。', catBug:'🐛 バグ報告', catFeature:'✨ 機能要望', catOther:'💭 その他', close:'閉じる' },
    'en':      { title:'💬 Feedback', desc:'Bug reports, feature requests — all welcome. Sent anonymously.', catLabel:'Category', bodyLabel:'Details', bodyPlaceholder:'Please describe in detail...', deviceLabel:'Attach device info (rank, score, etc.)', submit:'📨 Send', sending:'Sending...', success:'✅ Sent! Thank you.', error:'❌ Failed to send. Please try again.', catBug:'🐛 Bug Report', catFeature:'✨ Feature Request', catOther:'💭 Other', close:'Close' },
    'zh-hans': { title:'💬 反馈', desc:'欢迎提交错误报告和功能建议，匿名发送。', catLabel:'类别', bodyLabel:'内容', bodyPlaceholder:'请详细描述...', deviceLabel:'附加设备信息（等级、分数等）', submit:'📨 发送', sending:'发送中...', success:'✅ 已发送！感谢您的反馈。', error:'❌ 发送失败，请重试。', catBug:'🐛 错误报告', catFeature:'✨ 功能建议', catOther:'💭 其他', close:'关闭' },
    'zh-hant': { title:'💬 回饋', desc:'歡迎提交錯誤報告和功能建議，匿名發送。', catLabel:'類別', bodyLabel:'內容', bodyPlaceholder:'請詳細描述...', deviceLabel:'附加裝置資訊（等級、分數等）', submit:'📨 發送', sending:'發送中...', success:'✅ 已發送！感謝您的回饋。', error:'❌ 發送失敗，請重試。', catBug:'🐛 錯誤報告', catFeature:'✨ 功能建議', catOther:'💭 其他', close:'關閉' },
    'ko':      { title:'💬 피드백', desc:'버그 보고, 기능 요청 등 편하게 보내주세요. 익명으로 전송됩니다.', catLabel:'카테고리', bodyLabel:'내용', bodyPlaceholder:'자세히 설명해 주세요...', deviceLabel:'기기 정보 첨부 (등급, 점수 등)', submit:'📨 전송', sending:'전송 중...', success:'✅ 전송되었습니다! 감사합니다.', error:'❌ 전송 실패. 다시 시도해 주세요.', catBug:'🐛 버그 보고', catFeature:'✨ 기능 요청', catOther:'💭 기타', close:'닫기' },
    'vi':      { title:'💬 Phản hồi', desc:'Báo lỗi, yêu cầu tính năng — đều được chào đón. Gửi ẩn danh.', catLabel:'Danh mục', bodyLabel:'Nội dung', bodyPlaceholder:'Vui lòng mô tả chi tiết...', deviceLabel:'Đính kèm thông tin thiết bị (hạng, điểm, v.v.)', submit:'📨 Gửi', sending:'Đang gửi...', success:'✅ Đã gửi! Cảm ơn bạn.', error:'❌ Gửi thất bại. Vui lòng thử lại.', catBug:'🐛 Báo lỗi', catFeature:'✨ Yêu cầu tính năng', catOther:'💭 Khác', close:'Đóng' },
    'es':      { title:'💬 Comentarios', desc:'Informes de errores, solicitudes de funciones — todo bienvenido. Enviado de forma anónima.', catLabel:'Categoría', bodyLabel:'Detalles', bodyPlaceholder:'Por favor describe con detalle...', deviceLabel:'Adjuntar info del dispositivo (rango, puntuación, etc.)', submit:'📨 Enviar', sending:'Enviando...', success:'✅ ¡Enviado! Gracias.', error:'❌ Error al enviar. Inténtalo de nuevo.', catBug:'🐛 Reporte de error', catFeature:'✨ Solicitud de función', catOther:'💭 Otro', close:'Cerrar' },
    'pt':      { title:'💬 Feedback', desc:'Relatórios de bugs, solicitações de recursos — tudo bem-vindo. Enviado anonimamente.', catLabel:'Categoria', bodyLabel:'Detalhes', bodyPlaceholder:'Por favor descreva em detalhes...', deviceLabel:'Anexar info do dispositivo (rank, pontuação, etc.)', submit:'📨 Enviar', sending:'Enviando...', success:'✅ Enviado! Obrigado.', error:'❌ Falha ao enviar. Tente novamente.', catBug:'🐛 Relatório de bug', catFeature:'✨ Solicitação de recurso', catOther:'💭 Outro', close:'Fechar' },
    'fr':      { title:'💬 Commentaires', desc:'Rapports de bugs, demandes de fonctionnalités — tout est bienvenu. Envoyé anonymement.', catLabel:'Catégorie', bodyLabel:'Détails', bodyPlaceholder:'Veuillez décrire en détail...', deviceLabel:"Joindre les infos de l'appareil (rang, score, etc.)", submit:'📨 Envoyer', sending:'Envoi en cours...', success:'✅ Envoyé ! Merci.', error:'❌ Échec de l\'envoi. Veuillez réessayer.', catBug:'🐛 Rapport de bug', catFeature:'✨ Demande de fonctionnalité', catOther:'💭 Autre', close:'Fermer' },
    'de':      { title:'💬 Feedback', desc:'Fehlerberichte, Funktionswünsche — alles willkommen. Anonym gesendet.', catLabel:'Kategorie', bodyLabel:'Details', bodyPlaceholder:'Bitte beschreiben Sie im Detail...', deviceLabel:'Geräteinformationen anhängen (Rang, Score, etc.)', submit:'📨 Senden', sending:'Wird gesendet...', success:'✅ Gesendet! Danke.', error:'❌ Senden fehlgeschlagen. Bitte erneut versuchen.', catBug:'🐛 Fehlerbericht', catFeature:'✨ Funktionswunsch', catOther:'💭 Sonstiges', close:'Schließen' },
    'ru':      { title:'💬 Обратная связь', desc:'Отчёты об ошибках, пожелания — всё приветствуется. Отправляется анонимно.', catLabel:'Категория', bodyLabel:'Описание', bodyPlaceholder:'Пожалуйста, опишите подробно...', deviceLabel:'Прикрепить информацию об устройстве (ранг, счёт и т.д.)', submit:'📨 Отправить', sending:'Отправка...', success:'✅ Отправлено! Спасибо.', error:'❌ Ошибка отправки. Попробуйте ещё раз.', catBug:'🐛 Сообщение об ошибке', catFeature:'✨ Пожелание', catOther:'💭 Другое', close:'Закрыть' },
    'ja-hira': { title:'💬 ふぃーどばっく', desc:'ばぐほうこくやきのうようぼうなど、きがるにどうぞ。とくめいでそうしんされます。', catLabel:'かてごり', bodyLabel:'ないよう', bodyPlaceholder:'くわしくおしえてください...', deviceLabel:'でばいすじょうほうをてんぷする', submit:'📨 そうしんする', sending:'そうしんちゅう...', success:'✅ そうしんしました！', error:'❌ そうしんしっぱい。もういちどおためしください。', catBug:'🐛 ばぐほうこく', catFeature:'✨ きのうようぼう', catOther:'💭 そのほか', close:'とじる' },
};

function _fbT() { return FB_I18N[_settings.language] || FB_I18N['ja']; }

function openFeedback() {
    const d = _fbT();
    const modal = document.getElementById('feedback-modal');
    // テキスト更新
    document.getElementById('feedback-title').textContent       = d.title;
    document.getElementById('feedback-desc').textContent        = d.desc;
    document.getElementById('feedback-cat-label').textContent   = d.catLabel;
    document.getElementById('feedback-body-label').textContent  = d.bodyLabel;
    document.getElementById('feedback-body').placeholder        = d.bodyPlaceholder;
    document.getElementById('feedback-device-label').textContent = d.deviceLabel;
    document.getElementById('feedback-submit-label').textContent = d.submit;
    document.getElementById('feedback-status').textContent      = '';
    // カテゴリボタン
    const cats = document.getElementById('feedback-cats');
    cats.children[0].textContent = d.catBug;
    cats.children[1].textContent = d.catFeature;
    cats.children[2].textContent = d.catOther;
    // デバイス添付トグル（デフォルトON）
    _fbDeviceAttach = true;
    _updateFbDeviceToggle();
    // テキストエリアクリア
    document.getElementById('feedback-body').value = '';
    // 最初のカテゴリをアクティブに
    document.querySelectorAll('.fb-cat').forEach((b, i) => b.classList.toggle('active', i === 0));
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    modal.onclick = e => { if (e.target === modal) closeFeedback(); };
}

function closeFeedback() {
    const modal = document.getElementById('feedback-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

function selectFbCat(btn) {
    document.querySelectorAll('.fb-cat').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function toggleFbDevice() {
    _fbDeviceAttach = !_fbDeviceAttach;
    _updateFbDeviceToggle();
}

function _updateFbDeviceToggle() {
    const tog   = document.getElementById('fb-device-toggle');
    const thumb = document.getElementById('fb-device-thumb');
    if (!tog || !thumb) return;
    tog.style.background = _fbDeviceAttach ? '#34c759' : '#555';
    thumb.style.right    = _fbDeviceAttach ? '2px' : 'auto';
    thumb.style.left     = _fbDeviceAttach ? 'auto' : '2px';
}

async function submitFeedback() {
    const d       = _fbT();
    const body    = document.getElementById('feedback-body').value.trim();
    const catBtn  = document.querySelector('.fb-cat.active');
    const cat     = catBtn ? catBtn.getAttribute('data-val') : 'other';
    const catText = catBtn ? catBtn.textContent.trim() : 'other';
    const status  = document.getElementById('feedback-status');
    const submitBtn = document.getElementById('feedback-submit');

    if (!body) {
        status.style.color = '#ff6b6b';
        status.textContent = '内容を入力してください。';
        return;
    }

    // デバイス情報
    let deviceInfo = '';
    if (_fbDeviceAttach) {
        const rank  = document.getElementById('rank-letter')?.textContent || '?';
        const eval_ = document.getElementById('eval-msg')?.textContent   || '';
        const lang  = _settings.language;
        const ua    = navigator.userAgent.slice(0, 120);
        const rankEmoji = { S:'🔴 S', A:'🟠 A', B:'🟢 B', C:'🔵 C', D:'⚫ D' };
        deviceInfo  = `\n\n--- Device Info ---\nRank: ${rankEmoji[rank] || rank}\n${eval_}\nLang: ${lang}\nUA: ${ua}`;
    }

    submitBtn.disabled = true;
    document.getElementById('feedback-submit-label').textContent = d.sending;
    status.textContent = '';

    try {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body:    JSON.stringify({
                category: catText,
                message:  body + deviceInfo,
                _subject: `[ProUltra Feedback] ${catText}`,
            })
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
            status.style.color = '#34c759';
            status.textContent = d.success;
            document.getElementById('feedback-body').value = '';
            setTimeout(() => closeFeedback(), 2000);
        } else {
            const errMsg = json.errors?.map(e => e.message).join(', ') || `HTTP ${res.status}`;
            throw new Error(errMsg);
        }
    } catch(e) {
        status.style.color = '#ff6b6b';
        status.textContent = d.error + ' (' + (e.message || 'unknown') + ')';
    } finally {
        submitBtn.disabled = false;
        document.getElementById('feedback-submit-label').textContent = d.submit;
    }
}

// ══════════════════════════════════════════════════════════════
// 🆚 デバイス対戦システム
// ══════════════════════════════════════════════════════════════

// 自分の診断結果をオブジェクトにまとめる
function _getBattleData() {
    const rank  = document.getElementById('rank-letter')?.textContent || '?';
    const eval_ = document.getElementById('eval-msg')?.textContent   || '';
    return {
        rank,
        evalMsg: eval_,
        totalScore: parseInt(eval_.match(/(\d+)\/100/)?.[1] || 0),
        cpu:  scores.cpu,
        gpu:  scores.gpu,
        mem:  scores.mem,
        fps:  scores.fps,
        ram:  diag.memResult?.gb || 0,
        net:  diag.networkMbps  || 0,
        avgFps: diag.avgFps    || 0,
        lowFps: diag.lowFps    || 0,
        device: diag.deviceName || '--',
        ua: navigator.userAgent.slice(0, 80),
        ts: Date.now(),
    };
}

// 6桁コード生成
function _genCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function openBattle() {
    const modal = document.getElementById('battle-modal');
    const cont  = document.getElementById('battle-content');
    cont.innerHTML = `
        <p style="color:#888;font-size:0.85rem;margin:0 0 20px;line-height:1.6;">友達と診断結果を比較します。方式を選んでください。</p>
        <div style="display:grid;gap:12px;margin-bottom:20px;">
            <button onclick="battleFirestore()" style="padding:16px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;font-size:1rem;font-weight:800;cursor:pointer;text-align:left;">
                🔢 Firestoreコード方式<br>
                <span style="font-size:0.78rem;font-weight:400;opacity:0.85;">6桁コードを発行→友達がコード入力（有効期限20分）</span>
            </button>
            <button onclick="battleURL()" style="padding:16px;border-radius:16px;background:linear-gradient(135deg,#ff6b35,#ff2d55);color:#fff;border:none;font-size:1rem;font-weight:800;cursor:pointer;text-align:left;">
                🔗 QRコード・URL方式<br>
                <span style="font-size:0.78rem;font-weight:400;opacity:0.85;">QRまたはURLをシェア→オフラインでも使える</span>
            </button>
        </div>
        <div style="border-top:1px solid #2a2a2a;padding-top:16px;">
            <p style="color:#888;font-size:0.85rem;margin:0 0 10px;">友達からコード・URLをもらった場合：</p>
            <div style="display:flex;gap:8px;">
                <input id="battle-code-input" type="text" maxlength="6" placeholder="6桁コードを入力"
                    style="flex:1;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#fff;font-size:1rem;outline:none;text-align:center;letter-spacing:0.2em;">
                <button onclick="joinBattleCode()" style="padding:10px 18px;border-radius:12px;background:#007aff;color:#fff;border:none;font-weight:800;cursor:pointer;">参加</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    modal.onclick = e => { if (e.target === modal) closeBattle(); };
}

function closeBattle() {
    document.getElementById('battle-modal').style.display = 'none';
    document.body.style.overflow = '';
}

// ── Firestore方式：コード発行 ──
async function battleFirestore() {
    if (!_fbDb) {
        alert('Firestoreが利用できません。URLコード方式をお使いください。');
        return;
    }
    const code = _genCode();
    const data = _getBattleData();
    const cont = document.getElementById('battle-content');
    cont.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">コードを発行中...</p>';

    try {
        await _fbDb.collection('battles').doc(code).set({
            ...data,
            expires: Date.now() + 20 * 60 * 1000, // 20分
        });

        cont.innerHTML = `
            <p style="color:#34c759;font-size:0.85rem;margin:0 0 16px;text-align:center;">✅ コードを発行しました！友達に教えてください</p>
            <div style="background:#1a1a1a;border:2px solid #6366f1;border-radius:16px;padding:20px;text-align:center;margin-bottom:16px;">
                <div style="font-size:2.4rem;font-weight:900;letter-spacing:0.3em;color:#fff;">${code}</div>
                <div style="color:#888;font-size:0.78rem;margin-top:8px;">⏱ 有効期限：20分</div>
            </div>
            <div style="border-top:1px solid #2a2a2a;padding-top:16px;">
                <p style="color:#888;font-size:0.85rem;margin:0 0 10px;">友達が診断を終えたらコードを入力してもらってください。<br>自分も相手の結果を見たい場合は下に入力：</p>
                <div style="display:flex;gap:8px;">
                    <input id="battle-code-input" type="text" maxlength="6" placeholder="相手のコードを入力"
                        style="flex:1;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#fff;font-size:1rem;outline:none;text-align:center;letter-spacing:0.2em;">
                    <button onclick="joinBattleCode()" style="padding:10px 18px;border-radius:12px;background:#007aff;color:#fff;border:none;font-weight:800;cursor:pointer;">対戦</button>
                </div>
            </div>`;
    } catch(e) {
        cont.innerHTML = `<p style="color:#ff6b6b;text-align:center;">エラー: ${e.message}</p>`;
    }
}

// ── Firestore方式：コードで参加 ──
async function joinBattleCode() {
    const code = (document.getElementById('battle-code-input')?.value || '').trim();
    if (code.length !== 6) { alert('6桁のコードを入力してください'); return; }
    if (!_fbDb) { alert('Firestoreが利用できません'); return; }

    try {
        const doc = await _fbDb.collection('battles').doc(code).get();
        if (!doc.exists) { alert('コードが見つかりません'); return; }
        const opponent = doc.data();
        if (Date.now() > opponent.expires) { alert('このコードは有効期限切れです'); return; }
        closeBattle();
        showBattleResult(_getBattleData(), opponent, 'Firestore');
    } catch(e) {
        alert('エラー: ' + e.message);
    }
}

// ── URL/QR方式 ──
function battleURL() {
    const data   = _getBattleData();
    const params = new URLSearchParams({
        r:  data.rank,
        s:  data.totalScore,
        cp: data.cpu,
        gp: data.gpu,
        mm: data.mem,
        fp: data.fps,
        rm: data.ram,
        nt: Math.round(data.net),
        af: data.avgFps,
        lf: data.lowFps,
        dv: data.device.slice(0, 30),
    });
    const url  = location.origin + location.pathname + '?' + params.toString();
    const cont = document.getElementById('battle-content');

    cont.innerHTML = `
        <p style="color:#888;font-size:0.85rem;margin:0 0 16px;">このURLまたはQRコードを友達に送ってください。友達が診断後に自動で対戦画面が開きます。</p>
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
            <div id="battle-url-text" style="flex:1;color:#6bb5ff;font-size:0.72rem;word-break:break-all;line-height:1.4;">${url}</div>
            <button onclick="navigator.clipboard.writeText('${url.replace(/'/g,"\\'")}').then(()=>alert('コピーしました！'))" style="flex-shrink:0;padding:8px 14px;border-radius:10px;background:#007aff;color:#fff;border:none;font-weight:700;cursor:pointer;font-size:0.82rem;">コピー</button>
        </div>
        <div style="text-align:center;background:#fff;border-radius:12px;padding:12px;margin-bottom:12px;">
            <canvas id="battle-qr" width="180" height="180"></canvas>
        </div>
        <p style="color:#555;font-size:0.75rem;text-align:center;">QRコードをスキャン→診断→対戦結果が表示されます</p>`;

    // QRコード生成（qrcode.js CDN）
    _generateQR(url);
}

function _generateQR(url) {
    const script = document.getElementById('qrcode-script');
    const draw = () => {
        const canvas = document.getElementById('battle-qr');
        if (!canvas || !window.QRCode) return;
        QRCode.toCanvas(canvas, url, { width: 180, margin: 1, color: { dark:'#000', light:'#fff' } });
    };
    if (window.QRCode) { draw(); return; }
    const s  = document.createElement('script');
    s.id     = 'qrcode-script';
    s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = draw;
    document.head.appendChild(s);
}

// ── URLパラメータから対戦相手データを取得 ──
function _checkBattleURL() {
    const p = new URLSearchParams(location.search);
    if (!p.get('r') || !p.get('s')) return;
    const opponent = {
        rank:       p.get('r'),
        totalScore: parseInt(p.get('s') || 0),
        cpu:        parseInt(p.get('cp') || 0),
        gpu:        parseInt(p.get('gp') || 0),
        mem:        parseInt(p.get('mm') || 0),
        fps:        parseInt(p.get('fp') || 0),
        ram:        parseFloat(p.get('rm') || 0),
        net:        parseInt(p.get('nt') || 0),
        avgFps:     parseInt(p.get('af') || 0),
        lowFps:     parseInt(p.get('lf') || 0),
        device:     p.get('dv') || '--',
        fromURL:    true,
    };
    // 診断完了後に自動表示
    window._pendingBattleOpponent = opponent;
}

// ── 対戦結果表示 ──
function showBattleResult(me, opponent, mode) {
    const modal = document.getElementById('battle-result-modal');
    const cont  = document.getElementById('battle-result-content');
    const rankColors = {S:'#ff3b30',A:'#ff9500',B:'#34c759',C:'#007aff',D:'#8e8e93'};

    const items = [
        { label:'総合スコア', me: me.totalScore,  op: opponent.totalScore,  unit:'pt', higher: true },
        { label:'CPU',        me: me.cpu,          op: opponent.cpu,         unit:'pt', higher: true },
        { label:'GPU',        me: me.gpu,          op: opponent.gpu,         unit:'pt', higher: true },
        { label:'MEM帯域',    me: me.mem,          op: opponent.mem,         unit:'pt', higher: true },
        { label:'FPS安定',    me: me.fps,          op: opponent.fps,         unit:'pt', higher: true },
        { label:'RAM',        me: me.ram,          op: opponent.ram,         unit:'GB', higher: true },
        { label:'平均FPS',    me: me.avgFps,       op: opponent.avgFps,      unit:'',   higher: true },
        { label:'1%LOW FPS',  me: me.lowFps,       op: opponent.lowFps,      unit:'',   higher: true },
        { label:'ネット速度', me: Math.round(me.net), op: Math.round(opponent.net), unit:'M', higher: true },
    ];

    let meWins = 0, opWins = 0;
    const rows = items.map(item => {
        const meVal = item.me  || 0;
        const opVal = item.op  || 0;
        const meWin = item.higher ? meVal > opVal : meVal < opVal;
        const opWin = item.higher ? opVal > meVal : opVal < meVal;
        if (meWin) meWins++;
        if (opWin) opWins++;
        const meBg  = meWin ? 'rgba(52,199,89,0.15)'  : opWin ? 'rgba(255,59,48,0.08)' : 'rgba(255,255,255,0.04)';
        const opBg  = opWin ? 'rgba(52,199,89,0.15)'  : meWin ? 'rgba(255,59,48,0.08)' : 'rgba(255,255,255,0.04)';
        const meCol = meWin ? '#34c759' : opWin ? '#ff6b6b' : '#ccc';
        const opCol = opWin ? '#34c759' : meWin ? '#ff6b6b' : '#ccc';
        return `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:4px;align-items:center;margin-bottom:6px;">
            <div style="background:${meBg};border-radius:10px;padding:8px 10px;text-align:right;">
                <span style="font-weight:900;font-size:1rem;color:${meCol};">${meVal}${item.unit}</span>
                ${meWin ? '<span style="margin-left:4px;font-size:0.7rem;">✅</span>' : ''}
            </div>
            <div style="text-align:center;color:#555;font-size:0.72rem;font-weight:700;white-space:nowrap;padding:0 4px;">${item.label}</div>
            <div style="background:${opBg};border-radius:10px;padding:8px 10px;text-align:left;">
                ${opWin ? '<span style="margin-right:4px;font-size:0.7rem;">✅</span>' : ''}
                <span style="font-weight:900;font-size:1rem;color:${opCol};">${opVal}${item.unit}</span>
            </div>
        </div>`;
    }).join('');

    const winner = meWins > opWins ? '🏆 あなたの勝ち！' : opWins > meWins ? '😭 相手の勝ち！' : '🤝 引き分け！';
    const winnerColor = meWins > opWins ? '#34c759' : opWins > meWins ? '#ff6b6b' : '#ff9500';

    cont.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.04);border-radius:16px;">
            <div style="font-size:1.4rem;font-weight:900;color:${winnerColor};margin-bottom:6px;">${winner}</div>
            <div style="color:#888;font-size:0.85rem;">あなた ${meWins}勝 - ${opWins}勝 相手</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:4px;margin-bottom:12px;">
            <div style="text-align:center;">
                <div style="width:52px;height:52px;border-radius:12px;background:#000;border:3px solid ${rankColors[me.rank]||'#888'};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:900;color:${rankColors[me.rank]||'#888'};margin:0 auto 4px;">${me.rank}</div>
                <div style="color:#fff;font-size:0.8rem;font-weight:700;">あなた</div>
                <div style="color:#888;font-size:0.72rem;">${(me.device||'').slice(0,16)}</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#ff2d55;">VS</div>
            <div style="text-align:center;">
                <div style="width:52px;height:52px;border-radius:12px;background:#000;border:3px solid ${rankColors[opponent.rank]||'#888'};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:900;color:${rankColors[opponent.rank]||'#888'};margin:0 auto 4px;">${opponent.rank}</div>
                <div style="color:#fff;font-size:0.8rem;font-weight:700;">相手</div>
                <div style="color:#888;font-size:0.72rem;">${(opponent.device||'').slice(0,16)}</div>
            </div>
        </div>
        ${rows}
        <button onclick="document.getElementById('battle-result-modal').style.display='none'" style="width:100%;margin-top:16px;padding:13px;border-radius:14px;background:#1a1a1a;border:1px solid #333;color:#888;font-weight:700;cursor:pointer;">閉じる</button>`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function openTerms() {
    const lang = _settings.language;
    const d = TERMS_I18N[lang] || TERMS_I18N['ja'];
    const modal = document.getElementById('terms-modal');
    document.getElementById('terms-title').textContent = d.title;
    // 日付を動的に注入（_TERMS_DATE_ プレースホルダーを現在日付に置換）
    const now = new Date();
    const dateStr = now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + String(now.getDate()).padStart(2,'0');
    document.getElementById('terms-body').innerHTML = d.body.replace(/_TERMS_DATE_/g, dateStr);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    modal.onclick = e => { if (e.target === modal) closeTerms(); };
}

function closeTerms() {
    const modal = document.getElementById('terms-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

const HELP_TEXT_I18N = {
    'ja': [
        'CPUの論理コア数です。多いほど同時に多くの処理を並列実行できます。一般的な作業では4〜8コアで十分です。',
        '端末の物理メモリ（RAM）容量です。多いほど複数のアプリやタブを同時に快適に動かせます。',
        'GPUの種類・製品名です。グラフィック性能の目安になります。Apple GPU・NVIDIA・AMD・Intel等。',
        'GPUが一度に扱える画像（テクスチャ）の最大サイズです。大きいほど高精細な3D描画が可能です。',
        'このアプリによるCPU演算性能の実測値です。0〜100点で評価。75点以上が高性能の目安です。',
        'WebGLシェーダーとCanvas描画によるGPU性能の実測値です。0〜100点で評価します。',
        'メモリへの読み書き速度の実測値です。0〜100点で評価。低いと処理全体が遅くなります。',
        '実際に計測した1秒間の平均フレーム数です。60FPS以上で滑らかな動作と感じられます。',
        '最も重い場面での1%低フレーム数です。低いほどカクつきが目立ちます。55FPS以上が快適の目安。',
        'ディスプレイの1秒間の画面更新回数の推定値です。60Hz・120Hz・144Hzなど。',
        '物理的なピクセル数による実解像度です。DPRを掛けた値で、実際の表示精細さを示します。',
        '論理ピクセルと物理ピクセルの比率です。2x以上がRetinaディスプレイ相当で高精細です。',
        '色の表現力（ビット深度）とHDR対応の有無です。24bit以上・HDR対応が高品質の目安。',
        'JavaScriptが使用できる最大メモリ量です。大きいほど重い処理をこなせます。Firefoxは非対応。',
        'UIスレッドの応答遅延時間です。中央値が低いほどタップ・クリックへの反応が速いです。',
        '実際にデータをダウンロードして計測した通信速度です。100Mbps以上が高速の目安。',
        'ブラウザが認識している通信種別とAPI報告の帯域幅です。4G・WiFi等。参考値です。',
        '現在のバッテリー残量と充電状態です。残量20%未満・非充電の場合はランクが下がります。',
        '同時に認識できるタッチ点数です。10点以上がマルチタッチ対応の目安です。',
        'ダークモードとハイコントラストモードの設定状態です。OSの設定を反映しています。',
        '通信がHTTPS（暗号化）で行われているかどうかです。現代のWebでは必須の安全対策です。',
        'Cookieの有効状態とIndexedDB（ブラウザ内データベース）の対応状況です。',
        'WebGLのバージョンです。2.0が最新・高機能。非対応の場合は3D描画ができません。',
        'GPUが一度に処理できる頂点属性の最大数です。16以上が高性能GPUの目安です。',
        'WakeLock（画面維持）とVibration（振動）APIの対応状況です。主にモバイル向け機能。',
        'PWA（ホーム画面追加）とService Worker（オフライン機能）の対応状況です。',
        'WebDriverによる自動操縦（ボット）が検知されているかどうかです。通常は「正常」です。',
        'フレームレートの安定性スコアです。0〜100点で評価。高いほどカクつきが少ない安定した動作です。',
        '端末に設定されている言語とタイムゾーンです。情報として表示しています。',
        'このアプリの診断エンジンのバージョンです。',
        'WebRTCで取得したIPアドレスです。おおよその地域や利用プロバイダの特定に使われる場合があります。',
        'OSのダークモード設定とハイコントラスト設定の状態です。',
        '現在使用しているブラウザの種類です。',
        'UAから推定した端末の機種名です。Safariでは詳細なモデルが取得できない場合があります。',
    ],
    'en': [
        'Number of CPU logical cores. More cores allow more parallel processing. 4-8 cores is sufficient for general tasks.',
        'Physical RAM capacity. More RAM lets you run more apps and tabs simultaneously.',
        'GPU model name. Indicates graphics performance. Apple GPU, NVIDIA, AMD, Intel, etc.',
        'Maximum texture size the GPU can handle. Larger = higher-quality 3D rendering.',
        'CPU benchmark score measured by this app. 0-100. 75+ is high performance.',
        'GPU rendering score via WebGL shaders and Canvas. 0-100 scale.',
        'Memory read/write speed score. 0-100. Low scores slow down overall performance.',
        'Measured average frames per second. 60+ FPS feels smooth.',
        '1% low frame rate. Lower = more noticeable stuttering. 55+ FPS is comfortable.',
        'Estimated display refresh rate. 60Hz, 120Hz, 144Hz, etc.',
        'Physical pixel resolution. Higher = sharper display.',
        'Ratio of logical to physical pixels. 2x+ is Retina-equivalent.',
        'Color bit depth and HDR support. 24bit+ with HDR is high quality.',
        'Maximum JS heap memory. Larger = can handle heavier processing. Firefox unsupported.',
        'UI thread response latency. Lower median = faster tap/click response.',
        'Network speed measured by actual download. 100Mbps+ is fast.',
        'Connection type and API-reported bandwidth. 4G, WiFi, etc. Reference value.',
        'Battery level and charging status. Below 20% uncharged lowers your rank.',
        'Number of simultaneous touch points. 10+ supports full multi-touch.',
        'Dark mode and high contrast mode state from OS settings.',
        'Whether connection uses HTTPS encryption. Essential for modern web security.',
        'Cookie enabled state and IndexedDB support.',
        'WebGL version. 2.0 is latest. No support means no 3D rendering.',
        'Max GPU vertex attributes. 16+ indicates a capable GPU.',
        'WakeLock (keep screen on) and Vibration API support. Mainly mobile features.',
        'PWA (add to home screen) and Service Worker (offline) support.',
        'Whether WebDriver automation (bot) is detected. Normally "Normal".',
        'Frame rate stability score. 0-100. Higher = less stuttering.',
        'System language and timezone settings.',
        'Diagnostic engine version of this app.',
        'IP address obtained via WebRTC. May reveal approximate location/ISP.',
        'OS dark mode and high contrast settings.',
        'Current browser being used.',
        'Device model estimated from UA. Detailed model may not be available in Safari.',
    ],
    'zh-hans': [
        'CPU逻辑核心数。越多则可同时处理更多任务。日常使用4-8核已足够。',
        '物理内存(RAM)容量。越大则可同时运行更多应用和标签页。',
        'GPU型号名称。表示图形性能。Apple GPU、NVIDIA、AMD、Intel等。',
        'GPU可处理的最大纹理尺寸。越大则可进行更高精度的3D渲染。',
        '本应用测量的CPU基准分数。0-100分，75分以上为高性能。',
        '通过WebGL着色器和Canvas测量的GPU渲染分数。0-100分。',
        '内存读写速度分数。0-100分。分数低会导致整体处理速度变慢。',
        '实测平均每秒帧数。60FPS以上感觉流畅。',
        '1%低帧率。越低则卡顿越明显。55FPS以上为舒适标准。',
        '显示器刷新率估计值。60Hz、120Hz、144Hz等。',
        '物理像素分辨率。越高则显示越清晰。',
        '逻辑像素与物理像素的比值。2倍以上相当于Retina屏。',
        '色彩位深和HDR支持情况。24bit以上且支持HDR为高品质。',
        'JavaScript可用的最大堆内存。越大则可处理更重的任务。Firefox不支持。',
        'UI线程响应延迟。中位值越低则点击响应越快。',
        '通过实际下载测量的网络速度。100Mbps以上为高速。',
        '浏览器识别的连接类型和API报告带宽。4G、WiFi等。仅供参考。',
        '当前电池电量和充电状态。低于20%且未充电时会降低评级。',
        '可同时识别的触控点数量。10点以上支持完整多点触控。',
        '操作系统深色模式和高对比度模式的设置状态。',
        '连接是否使用HTTPS加密。现代网络安全的必要措施。',
        'Cookie启用状态和IndexedDB支持情况。',
        'WebGL版本。2.0为最新版本。不支持则无法进行3D渲染。',
        'GPU最大顶点属性数。16以上表示GPU性能较强。',
        'WakeLock(保持屏幕常亮)和振动API支持情况。主要为移动端功能。',
        'PWA(添加到主屏幕)和Service Worker(离线功能)支持情况。',
        '是否检测到WebDriver自动化(机器人)操作。正常情况下为"正常"。',
        '帧率稳定性分数。0-100分。越高则卡顿越少。',
        '系统语言和时区设置。',
        '本应用的诊断引擎版本。',
        '通过WebRTC获取的IP地址。可能用于推断大致位置或ISP。',
        '操作系统深色模式和高对比度设置状态。',
        '当前使用的浏览器。',
        '从UA推断的设备型号。Safari可能无法获取详细型号。',
    ],
    'zh-hant': [
        'CPU邏輯核心數。越多則可同時處理更多任務。日常使用4-8核已足夠。',
        '物理記憶體(RAM)容量。越大則可同時執行更多應用程式和分頁。',
        'GPU型號名稱。表示圖形效能。Apple GPU、NVIDIA、AMD、Intel等。',
        'GPU可處理的最大紋理尺寸。越大則可進行更高精度的3D渲染。',
        '本應用程式測量的CPU基準分數。0-100分，75分以上為高效能。',
        '透過WebGL著色器和Canvas測量的GPU渲染分數。0-100分。',
        '記憶體讀寫速度分數。0-100分。分數低會導致整體處理速度變慢。',
        '實測平均每秒影格數。60FPS以上感覺流暢。',
        '1%低影格率。越低則卡頓越明顯。55FPS以上為舒適標準。',
        '顯示器更新率估計值。60Hz、120Hz、144Hz等。',
        '物理像素解析度。越高則顯示越清晰。',
        '邏輯像素與物理像素的比值。2倍以上相當於Retina螢幕。',
        '色彩位深和HDR支援情況。24bit以上且支援HDR為高品質。',
        'JavaScript可用的最大堆積記憶體。越大則可處理更重的任務。Firefox不支援。',
        'UI執行緒回應延遲。中位值越低則點擊回應越快。',
        '透過實際下載測量的網路速度。100Mbps以上為高速。',
        '瀏覽器識別的連線類型和API報告頻寬。4G、WiFi等。僅供參考。',
        '目前電池電量和充電狀態。低於20%且未充電時會降低評級。',
        '可同時識別的觸控點數量。10點以上支援完整多點觸控。',
        '作業系統深色模式和高對比度模式的設定狀態。',
        '連線是否使用HTTPS加密。現代網路安全的必要措施。',
        'Cookie啟用狀態和IndexedDB支援情況。',
        'WebGL版本。2.0為最新版本。不支援則無法進行3D渲染。',
        'GPU最大頂點屬性數。16以上表示GPU效能較強。',
        'WakeLock(保持螢幕常亮)和振動API支援情況。主要為行動端功能。',
        'PWA(新增到主畫面)和Service Worker(離線功能)支援情況。',
        '是否偵測到WebDriver自動化(機器人)操作。正常情況下為「正常」。',
        '影格率穩定性分數。0-100分。越高則卡頓越少。',
        '系統語言和時區設定。',
        '本應用程式的診斷引擎版本。',
        '透過WebRTC取得的IP位址。可能用於推斷大致位置或ISP。',
        '作業系統深色模式和高對比度設定狀態。',
        '目前使用的瀏覽器。',
        '從UA推斷的裝置型號。Safari可能無法取得詳細型號。',
    ],
    'ko': [
        'CPU 논리 코어 수입니다. 많을수록 더 많은 작업을 병렬 처리할 수 있습니다.',
        '물리적 RAM 용량입니다. 클수록 더 많은 앱과 탭을 동시에 실행할 수 있습니다.',
        'GPU 모델명입니다. 그래픽 성능의 기준이 됩니다.',
        'GPU가 처리할 수 있는 최대 텍스처 크기입니다. 클수록 고화질 3D 렌더링이 가능합니다.',
        '이 앱이 측정한 CPU 벤치마크 점수입니다. 0-100점, 75점 이상이 고성능 기준입니다.',
        'WebGL 셰이더와 Canvas로 측정한 GPU 렌더링 점수입니다. 0-100점.',
        '메모리 읽기/쓰기 속도 점수입니다. 낮으면 전체 처리 속도가 느려집니다.',
        '실측 평균 초당 프레임 수입니다. 60FPS 이상이면 부드럽게 느껴집니다.',
        '1% 저프레임율입니다. 낮을수록 끊김이 두드러집니다. 55FPS 이상이 쾌적 기준.',
        '디스플레이 주사율 추정값입니다. 60Hz, 120Hz, 144Hz 등.',
        '물리적 픽셀 해상도입니다. 높을수록 화면이 선명합니다.',
        '논리 픽셀 대 물리 픽셀 비율입니다. 2배 이상이 레티나 디스플레이 수준입니다.',
        '색상 비트 심도와 HDR 지원 여부입니다. 24비트 이상 + HDR이 고품질 기준.',
        'JavaScript가 사용할 수 있는 최대 힙 메모리입니다. Firefox는 미지원.',
        'UI 스레드 응답 지연 시간입니다. 중앙값이 낮을수록 탭/클릭 반응이 빠릅니다.',
        '실제 다운로드로 측정한 네트워크 속도입니다. 100Mbps 이상이 고속 기준.',
        '브라우저가 인식하는 연결 유형과 API 보고 대역폭입니다. 4G, WiFi 등. 참고값.',
        '현재 배터리 잔량과 충전 상태입니다. 20% 미만 비충전 시 등급이 하락합니다.',
        '동시에 인식 가능한 터치 포인트 수입니다. 10개 이상이 멀티터치 지원 기준.',
        '운영체제의 다크 모드 및 고대비 모드 설정 상태입니다.',
        '연결이 HTTPS 암호화를 사용하는지 여부입니다. 현대 웹 보안의 필수 요소.',
        'Cookie 활성화 상태와 IndexedDB 지원 여부입니다.',
        'WebGL 버전입니다. 2.0이 최신. 미지원 시 3D 렌더링 불가.',
        'GPU 최대 정점 속성 수입니다. 16 이상이 고성능 GPU 기준.',
        'WakeLock(화면 유지)과 진동 API 지원 여부입니다. 주로 모바일 기능.',
        'PWA(홈 화면 추가)와 Service Worker(오프라인 기능) 지원 여부입니다.',
        'WebDriver 자동화(봇) 감지 여부입니다. 정상적으로는 "정상"으로 표시됩니다.',
        '프레임율 안정성 점수입니다. 0-100점, 높을수록 끊김이 적습니다.',
        '시스템 언어 및 시간대 설정입니다.',
        '이 앱의 진단 엔진 버전입니다.',
        'WebRTC로 얻은 IP 주소입니다. 대략적인 위치나 ISP 파악에 사용될 수 있습니다.',
        '운영체제 다크 모드 및 고대비 설정 상태입니다.',
        '현재 사용 중인 브라우저입니다.',
        'UA에서 추정한 기기 모델입니다. Safari에서는 상세 모델을 확인하지 못할 수 있습니다.',
    ],
    'vi': [
        'Số nhân logic CPU. Càng nhiều càng xử lý được nhiều tác vụ song song.',
        'Dung lượng RAM vật lý. Càng lớn càng chạy được nhiều ứng dụng và tab cùng lúc.',
        'Tên model GPU. Thể hiện hiệu suất đồ họa.',
        'Kích thước texture tối đa GPU có thể xử lý. Càng lớn càng render 3D chất lượng cao.',
        'Điểm benchmark CPU do ứng dụng đo. 0-100, từ 75 trở lên là hiệu suất cao.',
        'Điểm GPU qua WebGL shader và Canvas. Thang 0-100.',
        'Điểm tốc độ đọc/ghi bộ nhớ. Thấp sẽ làm chậm toàn bộ xử lý.',
        'FPS trung bình thực đo. Từ 60FPS trở lên cảm thấy mượt.',
        'FPS 1% thấp nhất. Càng thấp càng giật lag. Từ 55FPS trở lên là thoải mái.',
        'Tần số quét màn hình ước tính. 60Hz, 120Hz, 144Hz...',
        'Độ phân giải pixel vật lý. Càng cao màn hình càng sắc nét.',
        'Tỷ lệ pixel logic/vật lý. Từ 2x trở lên tương đương Retina.',
        'Độ sâu màu và hỗ trợ HDR. 24bit trở lên + HDR là chất lượng cao.',
        'Bộ nhớ JS heap tối đa. Càng lớn xử lý tác vụ nặng càng tốt. Firefox không hỗ trợ.',
        'Độ trễ UI thread. Trung vị càng thấp phản hồi chạm/click càng nhanh.',
        'Tốc độ mạng đo thực tế bằng download. Từ 100Mbps trở lên là nhanh.',
        'Loại kết nối và băng thông API báo cáo. 4G, WiFi... Giá trị tham khảo.',
        'Mức pin và trạng thái sạc. Dưới 20% không sạc sẽ giảm xếp hạng.',
        'Số điểm chạm đồng thời. Từ 10 trở lên hỗ trợ đa điểm chạm.',
        'Trạng thái chế độ tối và độ tương phản cao từ cài đặt hệ điều hành.',
        'Kết nối có dùng mã hóa HTTPS không. Bảo mật thiết yếu cho web hiện đại.',
        'Trạng thái Cookie và hỗ trợ IndexedDB.',
        'Phiên bản WebGL. 2.0 là mới nhất. Không hỗ trợ thì không render 3D được.',
        'Số thuộc tính đỉnh tối đa GPU. Từ 16 trở lên là GPU mạnh.',
        'Hỗ trợ WakeLock (giữ màn hình sáng) và Vibration API. Chủ yếu dành cho mobile.',
        'Hỗ trợ PWA (thêm vào màn hình chính) và Service Worker (ngoại tuyến).',
        'Có phát hiện tự động hóa WebDriver (bot) không. Thường sẽ hiển thị "Bình thường".',
        'Điểm ổn định frame rate. 0-100. Càng cao càng ít giật.',
        'Ngôn ngữ và múi giờ hệ thống.',
        'Phiên bản engine chẩn đoán của ứng dụng.',
        'Địa chỉ IP qua WebRTC. Có thể dùng để xác định vị trí gần đúng hoặc ISP.',
        'Trạng thái chế độ tối và độ tương phản cao của hệ điều hành.',
        'Trình duyệt đang sử dụng.',
        'Model thiết bị ước tính từ UA. Safari có thể không lấy được model chi tiết.',
    ],
    'es': [
        'Número de núcleos lógicos del CPU. Más núcleos permiten más procesamiento en paralelo.',
        'Capacidad de RAM física. Más RAM permite ejecutar más apps y pestañas simultáneamente.',
        'Nombre del modelo de GPU. Indica el rendimiento gráfico.',
        'Tamaño máximo de textura que puede manejar la GPU. Mayor = mejor renderizado 3D.',
        'Puntuación benchmark de CPU medida por esta app. 0-100, 75+ es alto rendimiento.',
        'Puntuación de renderizado GPU via WebGL shaders y Canvas. Escala 0-100.',
        'Puntuación de velocidad de lectura/escritura de memoria. Baja puntación ralentiza todo.',
        'FPS promedio medido. 60+ FPS se siente fluido.',
        'FPS 1% bajo. Más bajo = más tirones visibles. 55+ FPS es cómodo.',
        'Tasa de refresco estimada. 60Hz, 120Hz, 144Hz, etc.',
        'Resolución en píxeles físicos. Mayor = pantalla más nítida.',
        'Relación de píxeles lógicos vs físicos. 2x+ equivale a pantalla Retina.',
        'Profundidad de color y soporte HDR. 24bit+ con HDR es alta calidad.',
        'Memoria heap JS máxima. Mayor = puede manejar tareas más pesadas. Firefox no compatible.',
        'Latencia del hilo UI. Mediana más baja = respuesta más rápida al toque/clic.',
        'Velocidad de red medida por descarga real. 100Mbps+ es rápido.',
        'Tipo de conexión y ancho de banda reportado por API. 4G, WiFi, etc. Valor de referencia.',
        'Nivel de batería y estado de carga. Menos del 20% sin cargar baja el rango.',
        'Número de puntos táctiles simultáneos. 10+ soporta multitáctil completo.',
        'Estado del modo oscuro y alto contraste de la configuración del SO.',
        'Si la conexión usa cifrado HTTPS. Seguridad esencial para la web moderna.',
        'Estado habilitado de cookies y soporte IndexedDB.',
        'Versión de WebGL. 2.0 es la más reciente. Sin soporte = sin renderizado 3D.',
        'Atributos de vértice máximos de GPU. 16+ indica GPU capaz.',
        'Soporte WakeLock (mantener pantalla encendida) y API de vibración. Principalmente móvil.',
        'Soporte PWA (añadir a pantalla de inicio) y Service Worker (offline).',
        'Si se detecta automatización WebDriver (bot). Normalmente "Normal".',
        'Puntuación de estabilidad de frame rate. 0-100. Mayor = menos tirones.',
        'Configuración de idioma del sistema y zona horaria.',
        'Versión del motor de diagnóstico de esta app.',
        'Dirección IP obtenida via WebRTC. Puede revelar ubicación aproximada/ISP.',
        'Estado del modo oscuro y alto contraste del SO.',
        'Navegador actual en uso.',
        'Modelo del dispositivo estimado desde UA. Safari puede no mostrar modelo detallado.',
    ],
    'pt': [
        'Número de núcleos lógicos do CPU. Mais núcleos permitem mais processamento paralelo.',
        'Capacidade de RAM física. Mais RAM permite executar mais apps e abas simultaneamente.',
        'Nome do modelo de GPU. Indica o desempenho gráfico.',
        'Tamanho máximo de textura que a GPU pode processar. Maior = melhor renderização 3D.',
        'Pontuação benchmark de CPU medida por este app. 0-100, 75+ é alto desempenho.',
        'Pontuação de renderização GPU via WebGL shaders e Canvas. Escala 0-100.',
        'Pontuação de velocidade de leitura/escrita de memória. Baixa pontuação desacelera tudo.',
        'FPS médio medido. 60+ FPS parece fluido.',
        'FPS 1% baixo. Mais baixo = mais travamentos visíveis. 55+ FPS é confortável.',
        'Taxa de atualização estimada. 60Hz, 120Hz, 144Hz, etc.',
        'Resolução em pixels físicos. Maior = tela mais nítida.',
        'Relação de pixels lógicos vs físicos. 2x+ equivale a tela Retina.',
        'Profundidade de cor e suporte HDR. 24bit+ com HDR é alta qualidade.',
        'Memória heap JS máxima. Maior = pode lidar com tarefas mais pesadas. Firefox não suportado.',
        'Latência do thread de UI. Mediana mais baixa = resposta mais rápida ao toque/clique.',
        'Velocidade de rede medida por download real. 100Mbps+ é rápido.',
        'Tipo de conexão e largura de banda reportada por API. 4G, WiFi, etc. Valor de referência.',
        'Nível de bateria e status de carga. Abaixo de 20% sem carregar baixa a classificação.',
        'Número de pontos de toque simultâneos. 10+ suporta multitoque completo.',
        'Estado do modo escuro e alto contraste das configurações do SO.',
        'Se a conexão usa criptografia HTTPS. Segurança essencial para a web moderna.',
        'Estado habilitado de cookies e suporte IndexedDB.',
        'Versão do WebGL. 2.0 é a mais recente. Sem suporte = sem renderização 3D.',
        'Atributos de vértice máximos da GPU. 16+ indica GPU capaz.',
        'Suporte WakeLock (manter tela acesa) e API de vibração. Principalmente para mobile.',
        'Suporte PWA (adicionar à tela inicial) e Service Worker (offline).',
        'Se a automação WebDriver (bot) é detectada. Normalmente "Normal".',
        'Pontuação de estabilidade de taxa de quadros. 0-100. Maior = menos travamentos.',
        'Configuração de idioma do sistema e fuso horário.',
        'Versão do motor de diagnóstico deste app.',
        'Endereço IP obtido via WebRTC. Pode revelar localização aproximada/ISP.',
        'Estado do modo escuro e alto contraste do SO.',
        'Navegador atual em uso.',
        'Modelo do dispositivo estimado a partir do UA. Safari pode não mostrar modelo detalhado.',
    ],
    'fr': [
        'Nombre de cœurs logiques CPU. Plus de cœurs = plus de traitement parallèle.',
        'Capacité RAM physique. Plus de RAM = plus d\'apps et d\'onglets simultanés.',
        'Nom du modèle GPU. Indique les performances graphiques.',
        'Taille maximale de texture que le GPU peut gérer. Plus grand = meilleur rendu 3D.',
        'Score benchmark CPU mesuré par cette app. 0-100, 75+ est haute performance.',
        'Score de rendu GPU via WebGL et Canvas. Échelle 0-100.',
        'Score de vitesse lecture/écriture mémoire. Bas = ralentit tout le traitement.',
        'FPS moyen mesuré. 60+ FPS semble fluide.',
        'FPS 1% bas. Plus bas = saccades plus visibles. 55+ FPS est confortable.',
        'Taux de rafraîchissement estimé. 60Hz, 120Hz, 144Hz, etc.',
        'Résolution en pixels physiques. Plus élevée = écran plus net.',
        'Ratio pixels logiques/physiques. 2x+ équivaut à un écran Retina.',
        'Profondeur de couleur et support HDR. 24bit+ avec HDR est haute qualité.',
        'Mémoire heap JS maximale. Plus grande = peut gérer des tâches plus lourdes. Firefox non supporté.',
        'Latence du thread UI. Médiane plus basse = réponse plus rapide au toucher/clic.',
        'Vitesse réseau mesurée par téléchargement réel. 100Mbps+ est rapide.',
        'Type de connexion et bande passante rapportée par API. 4G, WiFi, etc. Valeur de référence.',
        'Niveau de batterie et état de charge. En dessous de 20% non chargé abaisse le rang.',
        'Nombre de points tactiles simultanés. 10+ supporte le multi-touch complet.',
        'État du mode sombre et du contraste élevé depuis les paramètres OS.',
        'Si la connexion utilise le chiffrement HTTPS. Sécurité essentielle pour le web moderne.',
        'État activé des cookies et support IndexedDB.',
        'Version WebGL. 2.0 est la plus récente. Sans support = pas de rendu 3D.',
        'Attributs de sommet maximum du GPU. 16+ indique un GPU capable.',
        'Support WakeLock (garder l\'écran allumé) et API de vibration. Principalement mobile.',
        'Support PWA (ajouter à l\'écran d\'accueil) et Service Worker (hors ligne).',
        'Si l\'automatisation WebDriver (bot) est détectée. Normalement "Normal".',
        'Score de stabilité du taux de frames. 0-100. Plus élevé = moins de saccades.',
        'Paramètres de langue et de fuseau horaire du système.',
        'Version du moteur de diagnostic de cette app.',
        'Adresse IP obtenue via WebRTC. Peut révéler la localisation approximative/FAI.',
        'État du mode sombre et du contraste élevé du SO.',
        'Navigateur actuellement utilisé.',
        'Modèle d\'appareil estimé depuis l\'UA. Safari peut ne pas afficher le modèle détaillé.',
    ],
    'de': [
        'Anzahl der CPU-Logikkerne. Mehr Kerne = mehr parallele Verarbeitung.',
        'Physischer RAM-Speicher. Mehr RAM = mehr Apps und Tabs gleichzeitig.',
        'GPU-Modellname. Zeigt die Grafikleistung an.',
        'Maximale Texturgröße der GPU. Größer = besseres 3D-Rendering.',
        'CPU-Benchmark-Score dieser App. 0-100, 75+ ist hohe Leistung.',
        'GPU-Rendering-Score via WebGL und Canvas. Skala 0-100.',
        'Speicher-Lese/Schreib-Geschwindigkeits-Score. Niedrig = verlangsamt alles.',
        'Gemessene durchschnittliche FPS. 60+ FPS fühlt sich flüssig an.',
        '1% Low FPS. Niedriger = mehr sichtbare Stottern. 55+ FPS ist komfortabel.',
        'Geschätzte Bildwiederholrate. 60Hz, 120Hz, 144Hz usw.',
        'Physische Pixel-Auflösung. Höher = schärferes Display.',
        'Verhältnis von logischen zu physischen Pixeln. 2x+ entspricht Retina-Display.',
        'Farbtiefe und HDR-Unterstützung. 24bit+ mit HDR ist hohe Qualität.',
        'Maximaler JS-Heap-Speicher. Größer = kann schwerere Aufgaben bewältigen. Firefox nicht unterstützt.',
        'UI-Thread-Latenz. Niedrigerer Median = schnellere Reaktion auf Tippen/Klicken.',
        'Netzwerkgeschwindigkeit gemessen durch echten Download. 100Mbps+ ist schnell.',
        'Verbindungstyp und API-gemeldete Bandbreite. 4G, WiFi usw. Referenzwert.',
        'Akkustand und Ladestatus. Unter 20% ohne Laden senkt den Rang.',
        'Anzahl gleichzeitiger Berührungspunkte. 10+ unterstützt vollständiges Multi-Touch.',
        'Dunkelmodus und Hochkontrastmodus-Status aus den OS-Einstellungen.',
        'Ob die Verbindung HTTPS-Verschlüsselung verwendet. Grundlegende Web-Sicherheit.',
        'Cookie-Status und IndexedDB-Unterstützung.',
        'WebGL-Version. 2.0 ist die neueste. Keine Unterstützung = kein 3D-Rendering.',
        'Max. GPU-Vertex-Attribute. 16+ zeigt eine leistungsfähige GPU an.',
        'WakeLock (Bildschirm aktiv halten) und Vibrations-API-Unterstützung. Hauptsächlich mobil.',
        'PWA (zum Startbildschirm hinzufügen) und Service Worker (offline) Unterstützung.',
        'Ob WebDriver-Automatisierung (Bot) erkannt wird. Normalerweise "Normal".',
        'Framerate-Stabilitäts-Score. 0-100. Höher = weniger Stottern.',
        'Systemsprache und Zeitzoneneinstellungen.',
        'Diagnose-Engine-Version dieser App.',
        'IP-Adresse über WebRTC. Kann ungefähren Standort/ISP enthüllen.',
        'Dunkelmodus und Hochkontrast-Status des OS.',
        'Aktuell verwendeter Browser.',
        'Gerätemodell aus UA geschätzt. Safari zeigt möglicherweise kein detailliertes Modell.',
    ],
    'ru': [
        'Количество логических ядер CPU. Больше ядер = больше параллельных задач.',
        'Объём физической оперативной памяти. Больше RAM = больше приложений и вкладок одновременно.',
        'Название модели GPU. Показывает производительность графики.',
        'Максимальный размер текстуры GPU. Больше = лучший 3D-рендеринг.',
        'Оценка CPU от этого приложения. 0-100, 75+ — высокая производительность.',
        'Оценка GPU через WebGL и Canvas. Шкала 0-100.',
        'Оценка скорости чтения/записи памяти. Низкая = замедляет всё.',
        'Измеренный средний FPS. 60+ FPS ощущается плавно.',
        '1% низкий FPS. Ниже = больше заметных рывков. 55+ FPS — комфортно.',
        'Оценочная частота обновления экрана. 60Гц, 120Гц, 144Гц и т.д.',
        'Разрешение в физических пикселях. Выше = чётче экран.',
        'Соотношение логических и физических пикселей. 2x+ соответствует Retina-дисплею.',
        'Глубина цвета и поддержка HDR. 24бит+ с HDR — высокое качество.',
        'Максимальная куча JS. Больше = справляется с более тяжёлыми задачами. Firefox не поддерживает.',
        'Задержка UI-потока. Меньше медианы = быстрее реакция на касание/клик.',
        'Скорость сети, измеренная реальной загрузкой. 100 Мбит/с+ — быстро.',
        'Тип соединения и пропускная способность от API. 4G, WiFi и т.д. Справочное значение.',
        'Уровень заряда и статус зарядки. Ниже 20% без зарядки снижает ранг.',
        'Количество одновременных точек касания. 10+ поддерживает полный мультитач.',
        'Состояние тёмного режима и режима высокой контрастности в настройках ОС.',
        'Использует ли соединение шифрование HTTPS. Основа безопасности современного веба.',
        'Состояние cookies и поддержка IndexedDB.',
        'Версия WebGL. 2.0 — последняя. Нет поддержки = нет 3D-рендеринга.',
        'Максимальные атрибуты вершин GPU. 16+ указывает на мощный GPU.',
        'Поддержка WakeLock (удержание экрана) и Vibration API. В основном мобильные функции.',
        'Поддержка PWA (добавить на экран) и Service Worker (офлайн).',
        'Обнаружена ли автоматизация WebDriver (бот). Обычно "Нормально".',
        'Оценка стабильности частоты кадров. 0-100. Выше = меньше рывков.',
        'Язык системы и настройки часового пояса.',
        'Версия диагностического движка этого приложения.',
        'IP-адрес через WebRTC. Может раскрыть приблизительное местоположение/ISP.',
        'Состояние тёмного режима и высокой контрастности ОС.',
        'Текущий используемый браузер.',
        'Модель устройства, оценённая по UA. Safari может не отображать подробную модель.',
    ],
    'ja-hira': [
        'CPUのこあのかずです。おおいほどたくさんのしごとができます。',
        'めもりのようりょうです。おおいほどたくさんのあぷりをつかえます。',
        'GPUのしゅるいです。えのひょうじのはやさのめやすになります。',
        'GPUがあつかえるさいだいのがぞうのおおきさです。',
        'このあぷりがはかったCPUのせいのうのてんすうです。',
        'このあぷりがはかったGPUのせいのうのてんすうです。',
        'めもりのよみかきのはやさのてんすうです。',
        'じっさいにはかったへいきんFPSです。60いじょうがなめらかです。',
        'いちばんおもいばめんでのFPSです。ひくいとかくかくします。',
        'がめんのこうしんひんどのすいていちです。',
        'がめんのかいぞうどです。たかいほどきれいです。',
        'ろじかるぴくせるとふぃじかるぴくせるのひりつです。',
        'いろのふかさとHDRのたいおうです。',
        'JavaScriptがつかえるさいだいのめもりりょうです。',
        'UIのおうとうそくどです。すくないほどはやいです。',
        'じっさいにはかったつうしんそくどです。',
        'つうしんのしゅるいです。',
        'でんちののこりとじゅうでんのじょうたいです。',
        'どうじにさわれるゆびのかずです。',
        'だーくもーどのせっていです。',
        'あんごうつうしんをつかっているかどうかです。',
        'Cookieとほぞんきのうのたいおうです。',
        'WebGLのばーじょんです。',
        'GPUのさいだいちょうてんぞくせいすうです。',
        'WakeLockとしんどうのたいおうです。',
        'PWAとService Workerのたいおうです。',
        'ぼっとそうさかどうかのはんていです。',
        'FPSのあんていせいのてんすうです。',
        'げんごとたいむぞーんです。',
        'このしんだんあぷりのばーじょんです。',
        'WebRTCでとったIPあどれすです。',
        'だーくもーどのせっていです。',
        'いまつかっているぶらうざです。',
        'きしゅめいのすいていです。さふぁりではくわしいきしゅがわからないことがあります。',
    ],
};

const helpText = HELP_TEXT_I18N['ja']; // 後方互換用（initHelpIconsで使用）

document.addEventListener('click', e => {
    if (!e.target.classList.contains('help')) return;
    const rowEl = e.target.closest('[id^="row-"]');
    if (!rowEl) return;
    const rowId = parseInt(rowEl.id.replace('row-', ''));
    const idx = rowId - 1; // 0始まり
    const lang = (typeof _settings !== 'undefined' && _settings.language) ? _settings.language : 'ja';
    const texts = HELP_TEXT_I18N[lang] || HELP_TEXT_I18N['ja'];
    alert(texts[idx] || '説明は準備中です。');
});