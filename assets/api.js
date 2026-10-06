window.API = {
  call: async function(action, payload = {}) {
    if (typeof CONFIG === 'undefined') throw new Error("config.js belum dimuat");
    
    if (CONFIG.USE_MOCK) {
      if (typeof window.mockApiCall !== 'function') throw new Error("Mock API belum dimuat");
      return window.mockApiCall(action, payload);
    }

    const isGet = action === 'getState';
    try {
      let response;
      if (isGet) {
        response = await fetch(`${CONFIG.API_URL}?action=${action}`, { cache: 'no-store' });
      } else {
        payload.action = action;
        response = await fetch(CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      }
      
      const json = await response.json();
      if (!json.ok) throw new Error(json.pesan || "Terjadi kesalahan di server");
      return json.data;
    } catch (err) {
      console.error("API Error:", err);
      throw err;
    }
  }
};
