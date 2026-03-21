let capturedDataUrl = null;
const scores = { cpu:0, gpu:0, mem:0, fps:0 };
const diag   = {};

const wait   = ms => new Promise(r => setTimeout(r, ms));
const setRow = (id, text, cls) => {
    document.getElementById('v-'+id).textContent = text;
    document.getElementById('row-'+id).className = 'spec-row st-'+cls;
};
const st = (ok, warn) => ok ? 'ok' : (warn ? 'warn' : 'bad');

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
        // gen15,2/15,3 = iPhone 14 Pro/ProMax → 上で捌いてる
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
        const w = screen.width;
        const h = screen.height;
        const dpr = window.devicePixelRatio;
        const key = `${w}x${h}@${dpr}`;

        const map = {
            // SE系
            "320x568@2": "iPhone SE",
            "375x667@2": "iPhone SE (第2/3世代)",

            // X〜11系
            "375x812@3": "iPhone X / XS / 11 Pro",

            // XR / 11
            "414x896@2": "iPhone XR / 11",

            // Max系（古）
            "414x896@3": "iPhone XS Max / 11 Pro Max",

            // 12〜14（標準）
            "390x844@3": "iPhone 12 / 13 / 14",

            // mini
            "360x780@3": "iPhone 12 / 13 mini",

            // Pro（6.1）
            "393x852@3": "iPhone 14 Pro",

            // Pro Max（〜14）
            "430x932@3": "iPhone 14 Pro Max",

            // ===== ここから追加 =====

            // 15 / 16 / 17（標準）
            "393x852@3": "iPhone 15 / 16 / 17",

            // Plus系
            "430x932@3": "iPhone 15 Plus / 16 Plus / 17 Plus",

            // Pro系
            "393x852@3": "iPhone 15 Pro / 16 Pro / 17 Pro",

            // Pro Max系
            "430x932@3": "iPhone 15 Pro Max / 16 Pro Max / 17 Pro Max"
        };

        return map[key] || "iPhone";
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

    // 推定残り時間タイマー
    // フェーズ別推定秒数（CPU~1s, GPU~1s, MEM~1s, MemEstimate~2s, NET~3s, BAT~1s, FPS=15s）
    const TOTAL_EST = 25;
    const benchStart = performance.now();
    let timerInterval = setInterval(() => {
        const elapsed = (performance.now() - benchStart) / 1000;
        const remaining = Math.max(0, Math.ceil(TOTAL_EST - elapsed));
        if (timeEl) {
            if (remaining > 0) {
                timeEl.textContent = '推定残り時間: 約 ' + remaining + ' 秒';
            } else {
                timeEl.textContent = '最終処理中...';
            }
        }
    }, 1000);
    // タイマーを止める関数をdiagに保持
    diag._stopTimer = () => {
        clearInterval(timerInterval);
        if (timeEl) timeEl.textContent = '';
    };

    el.textContent='CPU 演算性能を計測中...';
    msg.textContent='素数計算・行列積・ビット演算を実行しています';
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

    el.textContent='GPU 描画性能を計測中...';
    msg.textContent='WebGL シェーダー・Canvas 2D 合成描画を負荷試験中';
    await wait(50);
    scores.gpu=benchGPU();

    el.textContent='メモリ帯域を計測中...';
    msg.textContent='48MB バッファの シーケンシャル・ストライド・ランダムアクセスを測定中';
    await wait(50);
    scores.mem=benchMemory();

    el.textContent='システムメモリを精密解析中...';
    msg.textContent='5手法（API・ヒープ・アロケーション探索・コア相関・GPU特定）を統合中';
    await wait(40);
    diag.memResult=await estimateMemoryPrecise();

    el.textContent='ネットワーク速度を実測中...';
    msg.textContent='実際にデータを取得して実効帯域を計算しています';
    [diag.networkMbps, diag.publicIP] = await Promise.all([measureNetworkSpeed(), fetchPublicIP()]);

    el.textContent='バッテリー・UIレイテンシを計測中...';
    msg.textContent='Battery API・UIスレッド応答遅延を同時取得しています';
    [diag.battery, diag.latency] = await Promise.all([getBatteryInfo(), measureUILatency()]);

    diag.gpu=getGPUInfo();

    // ── Safari低電力モード検出（setTimeout間引き確認）──
    el.textContent='省電力モードを確認中...';
    msg.textContent='タイマー精度を計測しています';
    diag.safariThrottled = await detectSafariThrottle();

    el.textContent='フレームレート安定性を計測中...';
    msg.textContent='rAF遅延ギャップ方式・スケジューリング精度を15秒間精密計測中';
    // FPSは15秒固定なので残り時間を15秒にリセット
    if (diag._stopTimer) { diag._stopTimer(); }
    const fpsStart = performance.now();
    const fpsTimerEl = document.getElementById('time-remaining');
    const fpsTimer = setInterval(() => {
        const rem = Math.max(0, Math.ceil(15 - (performance.now()-fpsStart)/1000));
        if (fpsTimerEl) fpsTimerEl.textContent = rem > 0 ? '推定残り時間: 約 ' + rem + ' 秒 (FPS計測中)' : 'FPS集計中...';
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
    setRow(4,gpu.maxTex?gpu.maxTex+' px':'不明',st(gpu.maxTex>=16384,gpu.maxTex>=8192));

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
    setRow(11,physW+' × '+physH+' px',st(physW>=2560,physW>=1920));

    // 12. DPR
    const dpr=window.devicePixelRatio;
    setRow(12,dpr+'x',st(dpr>=3,dpr>=2));

    // 13. カラー深度 / HDR
    const depth=screen.colorDepth;
    const hdr=window.matchMedia('(dynamic-range: high)').matches;
    setRow(13,depth+'bit / HDR:'+(hdr?'対応':'非対応'),st(hdr&&depth>=30,depth>=24));

    // 14. JS ヒープ上限
    const heapMB=window.performance?.memory?Math.round(performance.memory.jsHeapSizeLimit/1048576):null;
    setRow(14,heapMB?heapMB+' MB':'非対応 (Firefox 等)',heapMB?st(heapMB>=4096,heapMB>=2048):'warn');

    // 15. UIスレッドレイテンシ（rAF→postMessage往復時間）
    const lat = diag.latency;
    if(lat){
        // 中央値16ms=60fps同期(正常), 8ms=120Hz, 32ms超=遅延あり
        const medMs = lat.medMs;
        setRow(15, `中央値 ${medMs} ms / P95: ${lat.p95Ms} ms`, st(medMs<=17, medMs<=35));
    } else {
        setRow(15,'計測不可','warn');
    }

    // 16. ネットワーク実測
    if(networkMbps!==null){
        setRow(16,networkMbps+' Mbps (実測)',st(networkMbps>=100,networkMbps>=20));
    } else {
        setRow(16,'計測失敗 (オフライン?)','warn');
    }

    // 17. 回線種別 / API 帯域
    const effType=navigator.connection?.effectiveType?.toUpperCase()??'不明';
    const dlAPI=navigator.connection?.downlink??null;
    setRow(17,effType+(dlAPI!==null?' / '+dlAPI+' Mbps':''),st(effType==='4G',effType==='3G'));

    // 18. バッテリー
    if(battery){
        const fmtMin = sec => {
            const m = Math.round(sec / 60);
            if (m >= 60) { const h = Math.floor(m/60); return h+'時間'+(m%60 ? m%60+'分' : ''); }
            return m+'分';
        };
        const t=battery.charging
            ?(battery.chargingTime===Infinity?(battery.level>=99?'ほぼ満充電':'')               :('残り'+fmtMin(battery.chargingTime)+'で満充電完了'))
            :(battery.dischargingTime===Infinity?'使用時間を計測中…':('残り約'+fmtMin(battery.dischargingTime)));
        const timeStr = t ? '  '+t : '';
        setRow(18,battery.level+'%  '+(battery.charging?'⚡充電中':'🔋放電中')+timeStr,
            st(battery.level>=80,battery.level>=30));
    } else {
        setRow(18,'API 非対応 (PC / Firefox)','warn');
    }

    // 19. タッチポイント数
    const tp=navigator.maxTouchPoints;
    setRow(19,tp+' ポイント',st(tp>=10,tp>=5));

    // 20. ダークモード / ハイコントラスト（緑グループに移動したので非表示）
    const dark=window.matchMedia('(prefers-color-scheme: dark)').matches;
    const hiCon=window.matchMedia('(prefers-contrast: high)').matches;
    document.getElementById('row-20').style.display='none';

    // 21. HTTPS
    const https=location.protocol==='https:';
    setRow(21,https?'安全 (HTTPS / TLS)':'非暗号 (HTTP)',https?'ok':'bad');

    // 22. Cookie / IndexedDB
    let idb=false; try{idb=!!window.indexedDB;}catch(e){}
    setRow(22,'Cookie:'+(navigator.cookieEnabled?'有効':'無効')+' / IDB:'+(idb?'対応':'非対応'),
        st(navigator.cookieEnabled&&idb,navigator.cookieEnabled));

    // 23. WebGL バージョン
    setRow(23,gpu.version,st(gpu.version==='WebGL 2.0',gpu.version==='WebGL 1.0'));

    // 24. WebGL 最大頂点属性数
    setRow(24,gpu.maxAttrib?gpu.maxAttrib+' 属性':'不明',st(gpu.maxAttrib>=16,gpu.maxAttrib>=8));

    // 25. WakeLock / 振動
    const wl='wakeLock' in navigator, vib='vibrate' in navigator;
    setRow(25,'WakeLock:'+(wl?'対応':'非対応')+' / Vib:'+(vib?'対応':'非対応'),st(wl&&vib,wl||vib));

    // 26. PWA / SW
    const sw='serviceWorker' in navigator;
    const pwa=window.matchMedia('(display-mode: standalone)').matches;
    setRow(26,'SW:'+(sw?'対応':'非対応')+' / PWA:'+(pwa?'起動中':'ブラウザ'),sw?'ok':'warn');

    // 27. WebDriver
    setRow(27,navigator.webdriver?'⚠ 自動操縦を検知':'正常 (手動操作)',!navigator.webdriver?'ok':'bad');

    // 28. FPS ジッタースコア
    setRow(28,scores.fps+' / 100 pts',st(scores.fps>=75,scores.fps>=50));

    // 29. 言語 / タイムゾーン
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    setRow(29,navigator.language.toUpperCase()+' / '+tz,'good');

    // 32. ダークモード / ハイコントラスト（緑・情報）
    setRow(32,'ダーク:'+(dark?'ON':'OFF')+' / ハイコン:'+(hiCon?'ON':'OFF'),'good');

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
        ipEl31.textContent = diag.publicIP + (isPriv ? ' (ローカル)' : '');
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

    const msgs={S:'最高峰のフラッグシップ性能です',A:'非常に快適で強力な環境です',B:'一般的な標準デバイス性能です',C:'動作の遅延が目立ち、やや非力です',D:'性能が不足している旧型環境です'};
    document.getElementById('status-title').textContent=msgs[rank];
    document.getElementById('eval-msg').textContent=
        `総合スコア ${totalScore}/100\nCPU:${scores.cpu}  GPU:${scores.gpu}  RAM:${ramGB}GB  MEM帯域:${scores.mem}  FPS安定:${scores.fps}  NET:${networkMbps??'?'}Mbps`;
    document.getElementById('ai-btn').style.display='block';
    document.getElementById('save-btn').style.display='block';
    document.getElementById('share-hint').style.display='block';
    document.getElementById('history-btn').style.display='block';
    document.getElementById('speed-btn').style.display='block';
    document.getElementById('retry-btn').style.display='block';

    // 診断完了トースト
    const doneToast = document.createElement('div');
    doneToast.textContent = '✅ 処理が完了しました';
    doneToast.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1c1c1e;color:#fff;padding:14px 28px;border-radius:40px;font-size:0.95rem;font-weight:700;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid #3a3a3c;z-index:999999;opacity:0;transition:opacity 0.3s;white-space:nowrap;';
    document.body.appendChild(doneToast);
    requestAnimationFrame(() => { doneToast.style.opacity = '1'; });
    setTimeout(() => {
        doneToast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(doneToast), 300);
    }, 2500);

    // ローカルストレージに結果を保存
    saveResultToHistory(totalScore, rank, scores, ramGB, diag.avgFps, diag.lowFps, diag.networkMbps);
}

/* ── キャプチャ ── */
// ── 警告フロー共通変数 ──────────────────────────────────────────
// _action: 'save'=保存, 'share'=シェア
let _ipMode  = 'show';
let _devMode = 'show';
let _action  = 'save';

// ── 保存ボタン ──────────────────────────────────────────────────
function triggerReportCapture() {
    _action = 'save';
    _ipMode = 'show';
    _devMode = 'show';
    if (diag.publicIP) {
        document.getElementById('ip-warn-overlay').style.display = 'flex';
    } else {
        showDeviceWarn();
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
        const _tout = setTimeout(() => _ctrl.abort(), 8000);
        const resp = await fetch('https://text.pollinations.ai/openai', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ model: 'openai', messages }),
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
    btn.textContent = '画像解析レポートを生成中...';
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
        toast.textContent = '✅ 画像の生成が完了しました';
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
        btn.textContent = '診断レポートを画像で保存する';
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
        if (history.length > 3) history.splice(3);
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

    if (history.length === 0) {
        cont.innerHTML = '<p style="color:var(--sub-text);text-align:center;padding:20px;">まだ診断結果がありません。</p>';
    } else {
        const rankColors = {S:'#ff3b30',A:'#ff9500',B:'#34c759',C:'#007aff',D:'#8e8e93'};
        cont.innerHTML = history.map((h, i) => `
            <div data-card-index="${i}" style="background:#1a1a1a;border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
                    <div style="width:52px;height:52px;border-radius:12px;background:#000;border:3px solid ${rankColors[h.rank]||'#888'};display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:900;color:${rankColors[h.rank]||'#888'};">${h.rank}</div>
                    <div style="flex:1;min-width:0;">
                        <div class="history-name-area">${h.name ? `<div style="font-weight:800;font-size:0.9rem;color:#6bb5ff;margin-bottom:2px;">📌 ${h.name}</div>` : ''}</div>
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
                    <button data-action="rename" data-index="${i}" style="flex:1;padding:9px;border-radius:10px;background:rgba(0,122,255,0.15);border:1px solid rgba(0,122,255,0.3);color:#6bb5ff;font-size:0.82rem;font-weight:700;cursor:pointer;">✏️ 名前をつける</button>
                    <button data-action="delete" data-index="${i}" style="flex:1;padding:9px;border-radius:10px;background:rgba(255,59,48,0.15);border:1px solid rgba(255,59,48,0.3);color:#ff6b6b;font-size:0.82rem;font-weight:700;cursor:pointer;">🗑 削除</button>
                </div>
            </div>
        `).join('');
    }
    modal.style.display = 'flex';

    // イベント委譲（innerHTML経由のonclickは効かないため）
    cont.onclick = (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.index);
        if (btn.dataset.action === 'rename')        renameHistory(idx);
        if (btn.dataset.action === 'rename-save')   saveRename(idx);
        if (btn.dataset.action === 'rename-cancel') showHistoryModal();
        if (btn.dataset.action === 'delete')        deleteHistory(idx);
    };
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
    // UIリセット
    document.getElementById('rank-letter').textContent = '?';
    document.getElementById('rank-letter').className   = 'rank-D';
    document.getElementById('status-title').textContent = 'ハードウェア精密スキャン中...';
    document.getElementById('eval-msg').textContent     = '各コンポーネントの整合性を検証しています';
    document.getElementById('b-fps-avg').textContent    = '-- FPS';
    document.getElementById('b-fps-low').textContent    = '-- FPS';
    document.getElementById('ai-btn').style.display      = 'none';
    document.getElementById('save-btn').style.display    = 'none';
    document.getElementById('share-hint').style.display  = 'none';
    document.getElementById('history-btn').style.display = 'none';
    document.getElementById('speed-btn').style.display   = 'none';
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
            if (user) syncHistoryFromCloud();
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
        loginBtn.style.display  = 'none';
        logoutBtn.style.display = 'block';
        if (user.photoURL) { avatar.src = user.photoURL; avatar.style.display = 'block'; }
        username.textContent = user.displayName || user.email || 'ユーザー';
        document.getElementById('auth-sync-status').textContent = '✓ 同期中';
        if (badge) {
            badge.style.display = 'block';
            badge.innerHTML = '🔓 <strong>' + (user.displayName || 'ログイン中') + '</strong> でログイン中 — 履歴がクラウドに同期されます';
        }
        // ログイン状態でauth-barの上に余白を追加（固定ヘッダー分）
        document.body.style.paddingTop = '49px';
    } else {
        loginBtn.style.display  = 'flex';
        logoutBtn.style.display = 'none';
        avatar.style.display    = 'none';
        username.textContent    = '';
        document.getElementById('auth-sync-status').textContent = '';
        if (badge) badge.style.display = 'none';
        document.body.style.paddingTop = '0';
    }
}

async function signInWithGoogle() {
    if (!_fbAuth) { alert("Firebase未設定です。FIREBASE_CONFIGを書き換えてください。"); return; }
    document.getElementById('auth-modal').style.display = 'none';
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await _fbAuth.signInWithPopup(provider);
    } catch(e) {
        if (e.code !== 'auth/popup-closed-by-user') {
            alert("ログインに失敗しました: " + e.message);
        }
    }
}

function signOut() {
    if (_fbAuth) _fbAuth.signOut();
}

// ── Firestore 履歴同期 ──────────────────────────────────────
async function syncHistoryToCloud(history) {
    if (!_currentUser || !_fbDb) return;
    try {
        await _fbDb.collection('users').doc(_currentUser.uid)
            .collection('diagnosis_history').doc('data')
            .set({ history, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('auth-sync-status').textContent = '✓ 同期済み';
    } catch(e) {
        document.getElementById('auth-sync-status').textContent = '⚠ 同期失敗';
    }
}

async function syncHistoryFromCloud() {
    if (!_currentUser || !_fbDb) return;
    try {
        document.getElementById('auth-sync-status').textContent = '同期中...';
        const doc = await _fbDb.collection('users').doc(_currentUser.uid)
            .collection('diagnosis_history').doc('data').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.history && Array.isArray(data.history)) {
                localStorage.setItem('diag_history', JSON.stringify(data.history));
                document.getElementById('auth-sync-status').textContent = '✓ 同期済み';
            }
        } else {
            // クラウドにデータなし → ローカルをクラウドに上げる
            const local = JSON.parse(localStorage.getItem('diag_history') || '[]');
            if (local.length > 0) await syncHistoryToCloud(local);
            document.getElementById('auth-sync-status').textContent = '✓ 同期済み';
        }
    } catch(e) {
        document.getElementById('auth-sync-status').textContent = '⚠ 同期失敗';
    }
}

function requireLogin(featureName, callback) {
    if (_currentUser) { callback(); return; }
    const msg = document.getElementById('auth-modal-msg');
    msg.textContent = featureName + 'はログインが必要です。Googleアカウントで無料登録できます。';
    document.getElementById('auth-modal').style.display = 'flex';
}

// ── AI会話のクラウド保存 ──────────────────────────────────────
async function syncAIConvsToCloud(convs) {
    if (!_currentUser || !_fbDb) return;
    try {
        await _fbDb.collection('users').doc(_currentUser.uid)
            .collection('ai_conversations').doc('data')
            .set({ convs, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch(e) {}
}

async function syncAIConvsFromCloud() {
    if (!_currentUser || !_fbDb) return;
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
    document.getElementById('b-ua').textContent = navigator.userAgent;
    document.getElementById('dl-btn').addEventListener('click', downloadCapturedImage);
    initFirebase();
    // 友達コードのCookieチェック
    if (checkFriendCookie()) { loadFriendFromCookie(); updateFriendAuthUI(true); }
    // Enterキーで友達コード送信
    document.getElementById('friend-code-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') checkFriendCode();
    });
    runBenchmark();
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

const helpText = {
  "CPU 論理コア数": "CPUのコア数です。多いほど同時に多くの処理を行えます。",
  "システムメモリ容量": "端末のメモリ容量です。多いほど複数アプリを快適に動かせます。",
  "GPU レンダラー": "GPUの種類です。グラフィック性能の目安になります。",
  "GPU 最大テクスチャサイズ": "扱える画像サイズの上限です。大きいほど高精細描画が可能です。",
  "実測 CPU ベンチスコア": "CPU性能を数値化したものです。",
  "実測 GPU 描画スコア": "GPUの描画性能を示します。",
  "実測メモリ帯域スコア": "メモリの転送速度の指標です。",
  "実測平均フレームレート": "平均FPSです。高いほど滑らかに動作します。",
  "実測 1% LOW フレームレート": "最低に近いFPSです。安定性を示します。",
  "画面リフレッシュレート": "1秒間の画面更新回数です。",
  "画面解像度": "画面のピクセル数です。",
  "デバイスピクセル比": "画面の精細さを表します。",
  "カラー深度 / HDR 対応": "色の表現力とHDR対応の有無です。",
  "JS ヒープ上限": "JavaScriptが使える最大メモリ量です。",
  "UIスレッド応答レイテンシ": "操作に対する反応速度です。",
  "ネットワーク速度": "実際の通信速度です。",
  "回線種別": "接続されているネットワークの種類です。",
  "バッテリー残量": "現在の電池残量と状態です。",
  "タッチポイント数": "同時に認識できるタッチ数です。",
  "セキュア通信": "通信が暗号化されているかどうかです。",
  "Cookie / IndexedDB": "データ保存機能の対応状況です。",
  "WebGL バージョン": "3D描画機能のバージョンです。",
  "WebGL 最大頂点属性数": "GPUの処理能力の指標の一つです。",
  "WakeLock / 振動 API": "画面維持や振動機能の対応です。",
  "PWA / Service Worker": "アプリ化やバックグラウンド処理機能です。",
  "自動操縦検知": "ボット操作かどうかの判定です。",
  "FPS ジッタースコア": "フレームの安定性を示します。",
  "システム言語": "端末の言語設定です。",
  "診断エンジンバージョン": "この診断ツールのバージョンです。",
  "IP アドレス": "インターネット上の識別番号です。",
  "ダークモード": "画面テーマ設定です。",
  "使用ブラウザ": "現在使っているブラウザです。",
  "デバイス機種": "端末の種類やモデルです。"
};

document.addEventListener('click', e => {
    if (!e.target.classList.contains('help')) return;

    const label = e.target.closest('.label').textContent
    .replace(/[＊*]/g,'')
    .trim();

console.log(label); // ←追加

    const found = Object.keys(helpText).find(k => label.includes(k));

    alert(helpText[found] || "この項目の説明は準備中です。");
});