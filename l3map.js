/* 3호선 열차 위치 — 라이브 렌더러 (train_data.json 사용)
   대상 컨테이너: 요소 id="l3map"  (없으면 무동작)
   calendar.html / train.html 양쪽에서 재사용. */
(function () {
  var PER_ROW = 10, X0 = 74, COL = 66, TOP = 40, ROWGAP = 104;
  var CUP = "#2b7de9", CDOWN = "#1fa463";
  var SUSONGMOT = { "어린이세상": 1, "황금": 1, "수성못": 1, "지산": 1, "범물": 1, "용지": 1 };
  var DATA = null, W = 0, H = 0, XY = {}, svg = null, sub = null, HOL = {}, FORCE = null;

  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayType(d) { if (FORCE) return FORCE; if (HOL[ymd(d)]) return "휴일"; var w = d.getDay(); return w === 0 ? "휴일" : (w === 6 ? "토요일" : "평일"); }

  function splitRuns(evs) {
    var runs = [], cur = [evs[0]];
    for (var i = 1; i < evs.length; i++) {
      if (evs[i][0] - cur[cur.length - 1][0] > 1800) { runs.push(cur); cur = [evs[i]]; }
      else cur.push(evs[i]);
    }
    runs.push(cur); return runs;
  }

  function stateOf(evs, nowsec) {
    var runs = splitRuns(evs);
    for (var r = 0; r < runs.length; r++) {
      var run = runs[r];
      if (nowsec < run[0][0] || nowsec > run[run.length - 1][0]) continue;
      var pos = null;
      for (var i = 0; i < run.length; i++) {
        var t0 = run[i][0], s0 = run[i][1], g0 = run[i][2];
        if (t0 > nowsec) break;
        var nxt = run[i + 1];
        if (nxt) {
          var t1 = nxt[0], s1 = nxt[1], g1 = nxt[2];
          if (g0 === 0 && s1 === s0 && g1 === 1) pos = { state: "정차", at: s0, eta: t1 - nowsec };
          else if (g0 === 1) { var seg = t1 - t0, fr = seg > 0 ? (nowsec - t0) / seg : 0; fr = Math.max(0, Math.min(1, fr)); pos = { state: "운행", from: s0, to: s1, eta: t1 - nowsec, frac: fr }; }
          else pos = { state: "정차", at: s0, next: s1, eta: t1 - nowsec };
        } else pos = { state: "종착", at: s0, eta: 0 };
      }
      if (pos) return pos;
    }
    return null;
  }

  function icon(x, y, color, num, arrow) {
    return '<g><circle cx="' + x + '" cy="' + y + '" r="11" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>' +
      '<text x="' + x + '" y="' + (y + 3.4) + '" font-size="9.5" text-anchor="middle" fill="#fff" font-weight="700">' + num + '</text>' +
      '<text x="' + x + '" y="' + (y - 15) + '" font-size="9.5" text-anchor="middle" fill="' + color + '">' + arrow + '</text></g>';
  }

  function layout() {
    var st = DATA.stations, n = st.length, rows = Math.ceil(n / PER_ROW);
    W = X0 * 2 + (PER_ROW - 1) * COL + 8; H = TOP + (rows - 1) * ROWGAP + 46;
    for (var i = 0; i < n; i++) {
      var row = Math.floor(i / PER_ROW), j = i % PER_ROW;
      var x = X0 + (row % 2 === 0 ? j : (PER_ROW - 1 - j)) * COL, y = TOP + row * ROWGAP;
      XY[st[i]] = [x, y];
    }
  }

  function render() {
    if (!DATA || !svg) return;
    var now = new Date();
    var st = DATA.stations;
    var nowsec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    var dt = dayType(now);
    var p = ['<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>'];
    var pts = st.map(function (s) { return XY[s][0] + "," + XY[s][1]; }).join(" ");
    p.push('<polyline points="' + pts + '" fill="none" stroke="#9fb4c9" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>');
    for (var i = 0; i < st.length; i++) {
      var s = st[i], xy = XY[s], x = xy[0], y = xy[1], hl = SUSONGMOT[s];
      p.push('<circle cx="' + x + '" cy="' + y + '" r="6.5" fill="' + (hl ? "#ffd166" : "#fff") + '" stroke="#2b5c9b" stroke-width="2.4"/>');
      var ly = y + 18 + (i % 2) * 13;
      p.push('<text x="' + x + '" y="' + ly + '" font-size="10.5" text-anchor="middle" font-weight="' + (hl ? "800" : "500") + '" fill="' + (hl ? "#b26a00" : "#33414f") + '">' + s + '</text>');
    }
    var count = 0, dirs = ["up", "down"];
    for (var di = 0; di < 2; di++) {
      var dkey = dirs[di];
      var tr = (DATA.sched[dkey] && DATA.sched[dkey][dt]) || {};
      var color = dkey === "up" ? CUP : CDOWN, arrow = dkey === "up" ? "▲" : "▼", sign = dkey === "up" ? 1 : -1;
      for (var tid in tr) {
        if (!tr.hasOwnProperty(tid)) continue;
        var pos = stateOf(tr[tid], nowsec); if (!pos) continue; count++;
        var x2, y2, ux = 1, uy = 0;
        if (pos.state === "운행") {
          var a = XY[st[pos.from]], b = XY[st[pos.to]]; if (!a || !b) continue;
          var f = pos.frac || 0; x2 = a[0] + (b[0] - a[0]) * f; y2 = a[1] + (b[1] - a[1]) * f;
          var dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.sqrt(dx * dx + dy * dy) || 1; ux = dx / ln; uy = dy / ln;
        } else { var c = XY[st[pos.at]]; if (!c) continue; x2 = c[0]; y2 = c[1]; }
        var o = 11 * sign; p.push(icon(x2 + ux * o, y2 + uy * o, color, tid, arrow));
      }
    }
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.style.aspectRatio = W + " / " + H;
    svg.innerHTML = p.join("");
    if (sub) sub.textContent = now.toLocaleString("ko-KR", { hour12: false }) + " · " + dt + " · 운행 중 " + count + "편 (추정)";
  }

  function start() {
    var box = document.getElementById("l3map");
    if (!box) return;
    sub = document.createElement("div");
    sub.className = "l3-sub";
    sub.textContent = "불러오는 중…";
    box.appendChild(sub);
    // 요일표 수동 전환 (기본=자동)
    var bar = document.createElement("div");
    bar.setAttribute("style", "display:flex;gap:6px;margin:4px 2px 8px;flex-wrap:wrap");
    var opts = [["", "자동"], ["평일", "평일"], ["토요일", "토요일"], ["휴일", "휴일"]];
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = o[1];
      var on = o[0] === "";
      b.setAttribute("style", "font:600 11px/1 'Noto Sans KR',sans-serif;padding:5px 10px;border-radius:999px;border:1px solid " + (on ? "#2b7de9" : "#cbd6e2") + ";background:" + (on ? "#2b7de9" : "#fff") + ";color:" + (on ? "#fff" : "#5b6b7c") + ";cursor:pointer");
      b.onclick = function () {
        FORCE = o[0] || null;
        Array.prototype.forEach.call(bar.children, function (c) {
          c.style.background = "#fff"; c.style.color = "#5b6b7c"; c.style.borderColor = "#cbd6e2";
        });
        b.style.background = "#2b7de9"; b.style.color = "#fff"; b.style.borderColor = "#2b7de9";
        render();
      };
      bar.appendChild(b);
    });
    box.appendChild(bar);
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("style", "display:block;width:100%;height:auto");
    box.appendChild(svg);
    fetch("train_data.json").then(function (r) { return r.json(); }).then(function (d) {
      DATA = d; HOL = {}; (d.holidays || []).forEach(function (x) { HOL[x] = 1; });
      layout(); render(); setInterval(render, 1000);
    }).catch(function (e) { sub.textContent = "데이터 로드 실패: " + e; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
