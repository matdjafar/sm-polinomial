// app.js (Siswa Logic)
let myData = {
  kelompok: localStorage.getItem('asp_kelompok') || '',
  nama: localStorage.getItem('asp_nama') || ''
};

let stateGame = {};
let pollingInterval = null;
let currentSoalId = null;
let timerInt = null;
let currentPolyTerms = [];

const UI = {
  grid: document.getElementById('gridSoal'),
  btnMasuk: document.getElementById('btnMasuk'),
  btnKirim: document.getElementById('btnKirim'),
  btnBatal: document.getElementById('btnBatal'),
  polyContainer: document.getElementById('polyTermsContainer'),
  btnTambahSuku: document.getElementById('btnTambahSuku'),
  polyPreview: document.getElementById('polyPreview')
};

function initGrid() {
  if(!UI.grid) return;
  UI.grid.innerHTML = '';
  // 90 soal dari 3 paket
  for(let i=1; i<=90; i++) {
    let btn = document.createElement('button');
    let localId = ((i - 1) % 30) + 1;
    let lvl = localId<=10 ? 'level-mudah' : (localId<=20 ? 'level-menengah' : 'level-sulit');
    btn.className = `kotak-soal ${lvl}`;
    btn.id = `btn-soal-${i}`;
    let poin = localId<=10 ? 100 : (localId<=20 ? 200 : 300);
    btn.innerHTML = `<div class="soal-id">${i}</div><div class="soal-poin">${poin}</div><div class="soal-label" id="lbl-soal-${i}"></div>`;
    btn.onclick = () => onSoalClick(i);
    UI.grid.appendChild(btn);
  }
}

if(document.getElementById('setupScreen')) {
  if(myData.kelompok && myData.nama) {
    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('arenaScreen').style.display = 'block';
    document.getElementById('displayNama').innerText = myData.nama;
    document.getElementById('displayKelompok').innerText = myData.kelompok;
    initGrid();
    startPolling();
  }

  UI.btnMasuk.onclick = () => {
    let k = document.getElementById('inputKelompok').value;
    let n = document.getElementById('inputNama').value.trim();
    if(!k || !n) return alert('Isi kelompok dan nama!');
    localStorage.setItem('asp_kelompok', k);
    localStorage.setItem('asp_nama', n);
    location.reload();
  };
}

async function startPolling() {
  await fetchState();
  pollingInterval = setInterval(fetchState, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(pollingInterval);
    else { fetchState(); pollingInterval = setInterval(fetchState, 3000); }
  });
}

async function fetchState() {
  try {
    const data = await API.call('getState');
    stateGame = data;
    updateUI();
  } catch(e) {
    console.error("Polling error", e);
  }
}

let bannerShown = false;
function updateUI() {
  if(!stateGame.pengaturan) return;
  
  let sk = stateGame.skorKelompok.find(x => x.kelompok == myData.kelompok);
  if(sk) {
    if(stateGame.pengaturan.tampilSkor) {
      document.getElementById('displayPoin').innerText = sk.poin;
      document.getElementById('displayPoin').parentElement.style.display = 'block';
      document.getElementById('alertSembunyi').style.display = 'none';
    } else {
      document.getElementById('displayPoin').parentElement.style.display = 'none';
      document.getElementById('alertSembunyi').style.display = 'block';
    }
    
    if(sk.poin >= parseInt(stateGame.pengaturan.targetPoin) && !bannerShown) {
      document.getElementById('bannerKel').innerText = myData.kelompok;
      document.getElementById('bannerTarget').style.display = 'block';
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      bannerShown = true;
    }
  }

  let mode = stateGame.pengaturan.modeKunci;
  for(let i=1; i<=90; i++) {
    let paket = Math.ceil(i / 30).toString();
    let localId = ((i - 1) % 30) + 1;
    
    let key = mode === 'GLOBAL' ? `${paket}_${localId}_GLOBAL` : `${paket}_${localId}_${myData.kelompok}`;
    let st = stateGame.statusSoal.find(s => s.key === key);
    let btn = document.getElementById(`btn-soal-${i}`);
    let lbl = document.getElementById(`lbl-soal-${i}`);
    if(!btn) continue;
    
    let lvl = localId<=10 ? 'level-mudah' : (localId<=20 ? 'level-menengah' : 'level-sulit');
    btn.className = `kotak-soal ${lvl}`;
    btn.disabled = false;
    lbl.innerText = '';
    
    if(st) {
      if(st.status === 'terjawab') {
        btn.classList.add('status-terjawab');
        btn.disabled = true;
        lbl.innerText = '✔ ' + (mode==='GLOBAL' ? `Kel.${st.kelompok}` : (st.nama || `Kel.${st.kelompok}`));
      } else if (st.status === 'hangus') {
        btn.classList.add('status-hangus');
        btn.disabled = true;
        lbl.innerText = '✖ Hangus';
      } else if (st.status === 'dikerjakan') {
        if(mode === 'GLOBAL' && st.kelompok != myData.kelompok) {
           btn.disabled = true;
           lbl.innerText = `🔒 Kel.${st.kelompok}`;
        } else if (st.kelompok == myData.kelompok) {
           btn.classList.add('status-dikerjakan');
           lbl.innerText = `Sedang Anda buka`;
        }
      }
    }
  }
}

// Polynomial Logic
function initPolyBuilder() {
  currentPolyTerms = [{ koef: '', var: '', pangkat: '' }];
  renderPolyBuilder();
}

function renderPolyBuilder() {
  if(!UI.polyContainer) return;
  UI.polyContainer.innerHTML = '';
  currentPolyTerms.forEach((t, idx) => {
    let row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '5px';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <input type="number" class="form-control" style="width:70px; padding:8px;" placeholder="Koef" value="${t.koef}" data-idx="${idx}" data-field="koef">
      <input type="text" class="form-control" style="width:60px; padding:8px;" placeholder="Var" value="${t.var}" data-idx="${idx}" data-field="var">
      <span>^</span>
      <input type="number" class="form-control" style="width:70px; padding:8px;" placeholder="Pkt" value="${t.pangkat}" data-idx="${idx}" data-field="pangkat">
      ${idx > 0 ? `<button class="btn btn-outline" style="padding:8px 10px; color:var(--sulit); border-color:var(--sulit)" onclick="removeTerm(${idx})">X</button>` : ''}
    `;
    UI.polyContainer.appendChild(row);
  });
  
  UI.polyContainer.querySelectorAll('input').forEach(inp => {
    inp.oninput = (e) => {
      let f = e.target.getAttribute('data-field');
      let i = parseInt(e.target.getAttribute('data-idx'));
      currentPolyTerms[i][f] = e.target.value;
      updatePolyPreview();
    };
  });
  updatePolyPreview();
}

window.removeTerm = function(idx) {
  currentPolyTerms.splice(idx, 1);
  renderPolyBuilder();
};

if(UI.btnTambahSuku) {
  UI.btnTambahSuku.onclick = () => {
    currentPolyTerms.push({ koef: '', var: '', pangkat: '' });
    renderPolyBuilder();
  };
}

function getSimplifiedPolynomialString(terms) {
  let map = {};
  terms.forEach(t => {
     let v = (t.var||'').trim().toLowerCase();
     let p = parseInt(t.pangkat) || 0;
     let k = parseFloat(t.koef) || 0;
     if (k === 0) return;
     if (v === '' || v === 'none') { v = ''; p = 0; }
     
     let key = v + '^' + p;
     if (!map[key]) map[key] = { var: v, pangkat: p, koef: 0 };
     map[key].koef += k;
  });
  
  let res = Object.values(map).filter(t => t.koef !== 0);
  res.sort((a, b) => {
     if (a.var !== b.var) return a.var.localeCompare(b.var);
     return b.pangkat - a.pangkat;
  });
  
  if (res.length === 0) return "0";
  
  let str = "";
  res.forEach((t, i) => {
    let kStr = t.koef > 0 && i > 0 ? "+" + t.koef : t.koef;
    if (t.koef === 1 && (t.var !== '' && t.pangkat > 0)) kStr = i > 0 ? "+" : "";
    if (t.koef === -1 && (t.var !== '' && t.pangkat > 0)) kStr = "-";
    
    let pStr = "";
    if (t.pangkat > 1) pStr = "^" + t.pangkat;
    let vStr = (t.pangkat === 0) ? "" : t.var;
    
    str += `${kStr}${vStr}${pStr} `;
  });
  return str.trim();
}

function updatePolyPreview() {
  if(!UI.polyPreview) return;
  let str = getSimplifiedPolynomialString(currentPolyTerms);
  if(str === "0" && currentPolyTerms.length > 0 && currentPolyTerms[0].koef === '') {
    UI.polyPreview.innerText = "0";
    UI.btnKirim.disabled = true;
  } else {
    UI.polyPreview.innerText = "\\(" + str.replace(/\^(\d+)/g, '^{$1}') + "\\)";
    if(window.MathJax) MathJax.typesetPromise([UI.polyPreview]);
    UI.btnKirim.disabled = false;
  }
}

function isPolynomialEqual(studentTerms, keyTerms) {
  let sStr = getSimplifiedPolynomialString(studentTerms).replace(/\s/g, '');
  let kStr = getSimplifiedPolynomialString(keyTerms).replace(/\s/g, '');
  return sStr === kStr;
}

function cleanMathString(str) {
  if (!str) return "";
  
  // 1. Fix exact OCR mojibake
  str = str.replace(/A\ufffd/g, '^2');
  str = str.replace(/A3/g, '^3');
  str = str.replace(/xA/g, 'x^2');
  str = str.replace(/x\ufffd['´`]/g, 'x^4');
  str = str.replace(/x\ufffd/g, 'x^5'); 
  str = str.replace(/Â²/g, '^2');
  str = str.replace(/Â³/g, '^3');
  str = str.replace(/â\ufffd\ufffd/g, '^4');
  str = str.replace(/â\ufffd/g, '^4');
  str = str.replace(/â ´/g, '^4');
  str = str.replace(/A1\/,"A/g, '1/x^2');
  
  // Strip any remaining unprintable replacements
  str = str.replace(/\ufffd/g, '');
  str = str.replace(/\$/g, '');
  
  // 2. Wrap standalone polynomials outside parentheses FIRST to avoid inner wrapping collisions
  str = str.replace(/\b(\d*[a-zA-Z]\^?\d*(?:\s*[-+]\s*\d*[a-zA-Z]?\^?\d*)+)\b/g, '$$$1$$');
  
  // 3. Wrap functions (e.g. P(x), V(x))
  str = str.replace(/\b([PVRFS]\([-0-9a-zA-Z]+\))/g, '$$$1$$');
  
  // 4. Wrap polynomial expressions in parentheses THAT DON'T ALREADY HAVE MathJax
  str = str.replace(/\(([^$)]*[a-zA-Z][^$)]*)\)/g, function(match, p1) {
    if (/karena|jika|dan|atau/i.test(match)) return match;
    return '$$' + p1 + '$$';
  });
  
  return str;
}

async function onSoalClick(globalId) {
  if(document.getElementById(`btn-soal-${globalId}`).disabled) return;
  
  let paket = Math.ceil(globalId / 30).toString();
  let localId = ((globalId - 1) % 30) + 1;
  
  try {
    let btn = document.getElementById(`btn-soal-${globalId}`);
    btn.innerText = '⏳';
    
    if (!window.BANK_SOAL || !window.BANK_SOAL[paket]) throw new Error("Data bank soal tidak ditemukan di frontend.");
    let soalData = window.BANK_SOAL[paket].find(s => s.id == localId);
    if (!soalData) throw new Error("ID Soal tidak ditemukan di paket ini.");
    
    await API.call('bukaSoal', { idSoal: localId, paket: paket, kelompok: myData.kelompok, nama: myData.nama });
    
    currentSoalId = globalId;
    document.getElementById('mId').innerText = globalId;
    document.getElementById('mLevelBadge').innerText = soalData.level;
    document.getElementById('mLevelBadge').style.background = `var(--${soalData.level.toLowerCase()})`;
    document.getElementById('mPoin').innerText = soalData.poin;
    document.getElementById('mSoalTeks').innerHTML = cleanMathString(soalData.soal);
    
    initPolyBuilder();
    
    if(window.MathJax) MathJax.typesetPromise([document.getElementById('mSoalTeks')]);
    
    document.getElementById('modalSoal').classList.add('active');
    
    // Timer dihilangkan
    if(document.getElementById('mTimer')) document.getElementById('mTimer').style.display = 'none';
    
  } catch(e) {
    alert(e.message);
  } finally {
    fetchState();
  }
}

function startTimer(seconds) {
  clearInterval(timerInt);
  let el = document.getElementById('mTimer');
  let s = seconds;
  el.innerText = `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  timerInt = setInterval(() => {
    s--;
    if(s < 0) {
      clearInterval(timerInt);
      el.innerText = "00:00";
      alert("Waktu habis!");
      closeModal(true);
      return;
    }
    let m = Math.floor(s/60);
    let sec = s%60;
    el.innerText = `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }, 1000);
}

async function closeModal(isTimeout=false) {
  document.getElementById('modalSoal').classList.remove('active');
  clearInterval(timerInt);
  if(currentSoalId) {
    try {
      let paket = Math.ceil(currentSoalId / 30).toString();
      let localId = ((currentSoalId - 1) % 30) + 1;
      await API.call('lepasSoal', { idSoal: localId, paket: paket, kelompok: myData.kelompok });
    } catch(e){}
    currentSoalId = null;
  }
  fetchState();
}

if(UI.btnBatal) UI.btnBatal.onclick = () => closeModal();

if(UI.btnKirim) {
  UI.btnKirim.onclick = async () => {
    if(currentPolyTerms.length === 0) return;
    
    let paket = Math.ceil(currentSoalId / 30).toString();
    let localId = ((currentSoalId - 1) % 30) + 1;
    let soalData = window.BANK_SOAL[paket].find(s => s.id == localId);
    let isBenar = isPolynomialEqual(currentPolyTerms, soalData.kunci);
    let poinLevel = soalData.poin;
    let jawabanTeks = getSimplifiedPolynomialString(currentPolyTerms);
    
    let idKey = `${paket}-${localId}-${myData.kelompok}-${myData.nama}-${Date.now()}`;
    
    UI.btnKirim.disabled = true;
    UI.btnKirim.innerText = 'Mengirim...';
    
    try {
      let res = await API.call('kirimJawaban', {
        idSoal: localId, paket: paket, kelompok: myData.kelompok, nama: myData.nama, 
        isBenar: isBenar, poinLevel: poinLevel, jawabanTeks: jawabanTeks, idempotencyKey: idKey
      });
      
      clearInterval(timerInt);
      currentSoalId = null;
      document.getElementById('modalSoal').classList.remove('active');
      
      let modalH = document.getElementById('modalHasil');
      let title = document.getElementById('hasilTitle');
      let poinEl = document.getElementById('hasilPoin');
      
      if(isBenar) {
        title.innerText = "Jawaban Benar!";
        title.style.color = "var(--mudah)";
        poinEl.innerText = `+${poinLevel} Poin`;
        poinEl.style.color = "var(--mudah)";
        confetti({particleCount: 150, spread: 80});
      } else {
        title.innerText = "Jawaban Salah!";
        title.style.color = "var(--sulit)";
        poinEl.innerText = `0 Poin (Soal Hangus)`;
        poinEl.style.color = "var(--text-muted)";
      }
      
      if(soalData.pembahasan && stateGame.pengaturan.tampilPembahasan) {
        let cleanPem = cleanMathString(soalData.pembahasan);
        let keyText = getSimplifiedPolynomialString(soalData.kunci).replace(/\^(\d+)/g, '^{$1}');
        document.getElementById('hasilPembahasan').innerHTML = `<b>Kunci: \\(${keyText}\\)</b><br><br>${cleanPem}`;
        if(window.MathJax) MathJax.typesetPromise([document.getElementById('hasilPembahasan')]);
        document.getElementById('hasilPembahasan').style.display = 'block';
      } else {
        document.getElementById('hasilPembahasan').style.display = 'none';
      }
      
      modalH.classList.add('active');
      fetchState();
    } catch(e) {
      alert(e.message);
    } finally {
      UI.btnKirim.innerText = 'Kirim Jawaban';
      UI.btnKirim.disabled = false;
    }
  };
}
