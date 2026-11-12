import { loadAll, onlyReadyWords } from './data.js';
import { initAudio, setAudioSettings, wordReady, audioListLoaded } from './audio.js';
import { route } from './screens.js';
import { settings } from './store.js';

async function boot() {
  const app = document.getElementById('app');
  try {
    await Promise.all([loadAll(), initAudio()]);
  } catch (e) {
    app.innerHTML = '<div class="center"><h1>資料讀取失敗</h1><p>' + e.message + '</p><p>請重新整理頁面。</p></div>';
    return;
  }
  if (audioListLoaded()) onlyReadyWords(wordReady);
  setAudioSettings(settings());
  addEventListener('hashchange', route);
  route();
}
boot();
