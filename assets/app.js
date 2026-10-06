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
  ansSingle: document.getElementById('ans_single')
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

// Smart grading system
function normalizeForSmartCheck(str) {
    if(!str) return "";
    let s = str.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
    s = s.replace(/hasilbagi/g, '').replace(/sisa/g, '').replace(/adalah/g, '').replace(/dan/g, '').replace(/yaitu/g, '').replace(/,$/, '');
    s = s.replace(/\)\(/g, '),('); // split factors
    let parts = s.split(',').map(p => p.trim()).filter(p => p !== '');
    parts.sort();
    return parts.join(',');
}

function checkAnswerSmart(student, key) {
    if(!student) return false;
    let sStr = student.toLowerCase().replace(/\s+/g, '').replace(/,/g, '');
    let kStr = key.toLowerCase().replace(/\s+/g, '').replace(/,/g, '');
    if (sStr === kStr) return true;
    
    let kNorm = normalizeForSmartCheck(key);
    let sNorm = normalizeForSmartCheck(student);
    if (kNorm === sNorm && kNorm !== "") return true;
    
    if (!student.includes('=') && key.includes('=')) {
        let rhs = key.split('=').pop().replace(/\./g, '').trim().toLowerCase().replace(/\s+/g, '');
        if (sStr === rhs) return true;
    }
    return false;
}

function cleanMathString(str) {
  if (!str) return "";
  
  // OCR mojibake fixes using Unicode escapes to prevent encoding corruption
  str = str.replace(/A\uFFFD/g, '<sup>2</sup>');
  str = str.replace(/A3/g, '<sup>3</sup>');
  str = str.replace(/xA/g, 'x<sup>2</sup>');
  
  // Fix â\ufffd... patterns (UTF-8 superscripts read as ISO-8859-1)
  str = str.replace(/\u00E2\uFFFD\u00B4/g, '<sup>4</sup>');
  str = str.replace(/\u00E2\uFFFD\u00B5/g, '<sup>5</sup>');
  str = str.replace(/\u00E2\uFFFD\u00B6/g, '<sup>6</sup>');
  str = str.replace(/\u00E2\uFFFD\u00B7/g, '<sup>7</sup>');
  str = str.replace(/\u00E2\uFFFD\u00B8/g, '<sup>8</sup>');
  str = str.replace(/\u00E2\uFFFD\u00B9/g, '<sup>9</sup>');
  
  // Generic fallback if â is missing
  str = str.replace(/x\uFFFD\u00B4/g, 'x<sup>4</sup>');
  str = str.replace(/x\uFFFD\u00B5/g, 'x<sup>5</sup>');
  str = str.replace(/x\uFFFD\u00B6/g, 'x<sup>6</sup>');
  str = str.replace(/x\uFFFD\u00B7/g, 'x<sup>7</sup>');
  str = str.replace(/x\uFFFD\u00B8/g, 'x<sup>8</sup>');
  str = str.replace(/x\uFFFD\u00B9/g, 'x<sup>9</sup>');
  
  // Generic fallback if \ufffd is replaced by something else
  str = str.replace(/\u00E2.\u00B4/g, '<sup>4</sup>');
  str = str.replace(/\u00E2.\u00B5/g, '<sup>5</sup>');
  str = str.replace(/\u00E2.\u00B6/g, '<sup>6</sup>');
  str = str.replace(/\u00E2.\u00B7/g, '<sup>7</sup>');
  str = str.replace(/\u00E2.\u00B8/g, '<sup>8</sup>');
  str = str.replace(/\u00E2.\u00B9/g, '<sup>9</sup>');
  
  // Fix specific cases with other quotes instead of acute accent
  str = str.replace(/x\uFFFD['`]/g, 'x<sup>4</sup>');
  str = str.replace(/x\uFFFD\?['`]/g, 'x<sup>4</sup>');
  str = str.replace(/x\uFFFD/g, 'x<sup>5</sup>'); // final fallback
  
  // Fix old Â² and Â³
  str = str.replace(/\u00C2\u00B2/g, '<sup>2</sup>'); // Â²
  str = str.replace(/\u00C2\u00B3/g, '<sup>3</sup>'); // Â³
  
  // Strip any remaining unprintable replacements
  str = str.replace(/\uFFFD/g, '');
  str = str.replace(/\$/g, '');
  
  // Convert standard ^N to <sup>N</sup>
  str = str.replace(/\^(\d+)/g, '<sup>$1</sup>');
  
  // Convert functions like P(x) to <i>P</i>(<i>x</i>)
  str = str.replace(/\b([PVRFS])\(([-0-9a-zA-Z]+)\)/g, '<i>$1</i>(<i>$2</i>)');
  
  // Italicize standalone math variables (x, y, a, b, c, d, k, n)
  str = str.replace(/(^|[^a-zA-Z0-9])([xyabcdkn])(?![a-zA-Z0-9])/g, '$1<i>$2</i>');
  str = str.replace(/(\d)([xyabcdkn])(?![a-zA-Z0-9])/g, '$1<i>$2</i>');
  
  return `<span class="math-css">${str}</span>`;
}

async function onSoalClick(globalId) {
  if(document.getElementById(`btn-soal-${globalId}`).disabled) return;
  
  let paket = Math.ceil(globalId / 30).toString();
  let localId = ((globalId - 1) % 30) + 1;
  let lvlIndex = localId <= 10 ? 1 : (localId <= 20 ? 2 : 3);
  let lvlName = lvlIndex === 1 ? 'Mudah' : (lvlIndex === 2 ? 'Sedang' : 'Sulit');
  
  let count = stateGame.statusSoal.filter(s => {
    if(s.kelompok != myData.kelompok) return false;
    let sLocal = parseInt(s.idSoal);
    let sLvl = sLocal <= 10 ? 1 : (sLocal <= 20 ? 2 : 3);
    return sLvl === lvlIndex;
  }).length;
  
  if(count >= 3) {
    alert(`Kelompok Anda sudah mencapai batas maksimal 3 soal untuk level ${lvlName}!`);
    return;
  }
  
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
    
    if(UI.ansSingle) {
      UI.ansSingle.value = "";
      UI.btnKirim.disabled = true;
      UI.ansSingle.oninput = () => {
        UI.btnKirim.disabled = (UI.ansSingle.value.trim() === "");
      };
    }
    
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
    let ansVal = UI.ansSingle ? UI.ansSingle.value.trim() : "";
    if(ansVal === "") return;
    
    let paket = Math.ceil(currentSoalId / 30).toString();
    let localId = ((currentSoalId - 1) % 30) + 1;
    let soalData = window.BANK_SOAL[paket].find(s => s.id == localId);
    let isBenar = checkAnswerSmart(ansVal, soalData.kunciTeksAsli);
    let poinLevel = soalData.poin;
    let jawabanTeks = ansVal;
    
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
        let keyText = cleanMathString(soalData.kunciTeksAsli);
        document.getElementById('hasilPembahasan').innerHTML = `<b>Kunci: ${keyText}</b><br><br>${cleanPem}`;
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
