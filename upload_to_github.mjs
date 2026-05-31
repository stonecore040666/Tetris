import fs from 'fs';
import path from 'path';

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'stonecore040666';
const REPO = 'Tetris';
const BASE_DIR = 'artifacts/tetris';
const IGNORE = [
  'node_modules', 'dist', '.git', '.replit-artifact',
  '.replit', 'replit.nix', '.upm', '.cache', '.config',
  'upload_to_github.mjs', 'push_to_github.sh', 'attached_assets',
  '.local', '.agents'
];

if (!TOKEN) { console.error('エラー: GITHUB_TOKEN 未設定'); process.exit(1); }

const api = async (endpoint, options = {}) => {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'replit-uploader',
      ...(options.headers || {})
    }
  });
  return res.json();
};

function getAllFiles(dir, base = '') {
  const files = [];
  for (const item of fs.readdirSync(dir)) {
    if (IGNORE.includes(item)) continue;
    const full = path.join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    if (fs.statSync(full).isDirectory()) {
      files.push(...getAllFiles(full, rel));
    } else {
      files.push({ localPath: full, repoPath: rel });
    }
  }
  return files;
}

console.log('ファイル一覧取得中...');
const files = getAllFiles(BASE_DIR);
console.log(`${files.length} ファイルを1つのコミットにまとめてアップロードします`);
console.log(`リポジトリ: ${OWNER}/${REPO}\n`);

console.log('blobを作成中...');
const treeItems = [];
for (const file of files) {
  const content = fs.readFileSync(file.localPath).toString('base64');
  const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'base64' })
  });
  treeItems.push({ path: file.repoPath, mode: '100644', type: 'blob', sha: blob.sha });
  process.stdout.write('.');
}
console.log('\n');

console.log('ツリー作成中...');
const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ tree: treeItems })
});

let commitBody = { message: 'Tetrisゲーム一式', tree: tree.sha };

const refData = await api(`/repos/${OWNER}/${REPO}/git/refs/heads/main`);
if (refData.object) {
  commitBody.parents = [refData.object.sha];
}

console.log('コミット作成中...');
const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
  method: 'POST',
  body: JSON.stringify(commitBody)
});

if (refData.object) {
  await api(`/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: true })
  });
} else {
  await api(`/repos/${OWNER}/${REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'refs/heads/main', sha: commit.sha })
  });
}

console.log('完了！1つのコミットでアップロードしました。');
console.log(`https://github.com/${OWNER}/${REPO}`);
