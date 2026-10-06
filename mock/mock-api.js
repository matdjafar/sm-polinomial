// Simulator Backend (Berjalan di Browser)
// Hanya aktif jika CONFIG.USE_MOCK = true

(function() {
  let state = {
    skorKelompok: [],
    statusSoal: [],
    log: [],
    pengaturan: {
      modeKunci: "GLOBAL",
      timerMenit: 3,
      targetPoin: 1000,
      tampilSkor: true,
      tampilPembahasan: true,
      paketAktif: "1"
    }
  };

  for(let i=1; i<=10; i++) state.skorKelompok.push({kelompok: i, poin: 0, benar: 0, salah: 0});

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function getState() { return JSON.parse(JSON.stringify(state)); }

  function bukaSoal(payload) {
    let { idSoal, paket, kelompok, nama } = payload;
    let key = `${paket}_${idSoal}_GLOBAL`; // Simulasi mode GLOBAL
    
    let st = state.statusSoal.find(s => s.key === key);
    if(st) {
      if(st.status === 'hangus') throw new Error("Soal ini sudah hangus");
      if(st.status === 'terjawab') throw new Error("Sudah dijawab kelompok lain");
      if(st.status === 'dikerjakan' && st.kelompok != kelompok) throw new Error(`Sedang dikerjakan kelompok ${st.kelompok}`);
    }

    if(!st) {
      state.statusSoal.push({ key: key, paket: paket, id: idSoal, status: 'dikerjakan', kelompok: kelompok, nama: nama, waktu: Date.now() });
    } else {
      st.status = 'dikerjakan';
      st.kelompok = kelompok;
      st.nama = nama;
      st.waktu = Date.now();
    }

    return { status: "locked" };
  }

  function kirimJawaban(payload) {
    let { idSoal, paket, kelompok, nama, isBenar, poinLevel, jawabanTeks, idempotencyKey } = payload;
    let key = `${paket}_${idSoal}_GLOBAL`; 
    let st = state.statusSoal.find(s => s.key === key);
    
    if(!st || st.status !== 'dikerjakan') throw new Error("Soal tidak bisa dijawab.");

    let poinDidapat = isBenar ? poinLevel : 0;
    let statusBaru = isBenar ? 'terjawab' : 'hangus';

    st.status = statusBaru;
    st.kelompok = kelompok;
    st.nama = nama;

    let sk = state.skorKelompok.find(s => s.kelompok == kelompok);
    if(sk) {
      sk.poin += poinDidapat;
      if(isBenar) sk.benar++; else sk.salah++;
    }

    state.log.unshift(`Kelompok ${kelompok} (${nama}) menjawab ${isBenar?'Benar':'Salah'} soal Paket ${paket} #${idSoal} ` + (isBenar ? `+${poinLevel}` : ''));

    return { success: true };
  }

  function lepasSoal(payload) {
    let { idSoal, paket, kelompok } = payload;
    let key = `${paket}_${idSoal}_GLOBAL`;
    let st = state.statusSoal.find(s => s.key === key);
    if(st && st.status === 'dikerjakan') {
      state.statusSoal = state.statusSoal.filter(s => s.key !== key);
    }
    return {pesan: "Dilepas"};
  }

  function guruLogin(payload) {
    if(payload.pin === "123456") return "MOCK_TOKEN";
    throw new Error("PIN Salah");
  }

  function aksiGuru(payload) {
    if(payload.token !== "MOCK_TOKEN") throw new Error("Sesi tidak valid");
    switch(payload.perintah) {
      case 'rekapSiswa': return [{ nama: "Test", kelompok: 1, totalPoin: 100, jumlahBenar: 1 }];
      case 'setPengaturan': state.pengaturan[payload.kunci] = payload.nilai; return {pesan: "OK"};
      case 'resetKelompok': 
        let k = payload.kelompok;
        let sk = state.skorKelompok.find(s => s.kelompok == k);
        if(sk) { sk.poin=0; sk.benar=0; sk.salah=0; }
        state.statusSoal = state.statusSoal.filter(s => s.kelompok != k);
        return {pesan: "Reset OK"};
      case 'resetSesi':
        state.statusSoal = [];
        state.log = [];
        state.skorKelompok.forEach(s => { s.poin=0; s.benar=0; s.salah=0; });
        return {pesan: "Sesi Direset"};
    }
  }

  window.mockApiCall = async function(action, payload) {
    await delay(300);
    switch(action) {
      case 'getState': return getState();
      case 'bukaSoal': return bukaSoal(payload);
      case 'kirimJawaban': return kirimJawaban(payload);
      case 'lepasSoal': return lepasSoal(payload);
      case 'guruLogin': return guruLogin(payload);
      case 'aksiGuru': return aksiGuru(payload);
      default: throw new Error("Action MOCK tidak valid");
    }
  };
})();
