// 24시간 지난 네컷 사진·영상 지우기 (GitHub Actions에서 1시간마다 실행)
// 필요한 값: SUPABASE_URL (변수), SUPABASE_SERVICE_KEY (비밀) — 비밀 키는 GitHub 저장소 Settings에만 넣어요
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = 'photobooth';
const HOURS = Number(process.env.KEEP_HOURS || 24);
if (!URL_ || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없어요'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function list(prefix, offset = 0) {
  const r = await fetch(`${URL_}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: H,
    body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) });
  if (!r.ok) throw new Error(`list ${prefix}: ${r.status} ${await r.text()}`);
  return r.json();
}
const cutoff = Date.now() - HOURS * 3600e3;
let removed = 0, kept = 0;
for (let off = 0; ; off += 1000) {
  const top = await list('', off);
  for (const e of top) {
    if (e.id) { // 최상위에 있는 파일
      if (new Date(e.created_at).getTime() < cutoff) await del([e.name]);
      continue;
    }
    const files = await list(`${e.name}/`);
    if (!files.length) continue;
    const newest = Math.max(...files.map((f) => new Date(f.created_at || 0).getTime()));
    if (newest < cutoff) { await del(files.map((f) => `${e.name}/${f.name}`)); removed++; } else kept++;
  }
  if (top.length < 1000) break;
}
async function del(paths) {
  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: paths }) });
  if (!r.ok) throw new Error(`delete: ${r.status} ${await r.text()}`);
}
console.log(`지운 회차 ${removed} · 남긴 회차 ${kept} (보관 ${HOURS}시간)`);
