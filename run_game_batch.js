const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MCP_URL = 'http://192.168.0.200:4700/mcp';
const API_URL = 'http://192.168.0.200:4700/api';
const FFMPEG = 'C:/Users/LeMinhKhanh(Lee)/AppData/Local/Monosnap/current/FFmpeg/ffmpeg.exe';
const AUTOTEST_USER = 'MinhKhanh';

const LINES_20 = {
  line_1: [5,6,7,8,9],
  line_2: [0,1,2,3,4],
  line_3: [10,11,12,13,14],
  line_4: [0,6,12,8,4],
  line_5: [10,6,2,8,14],
  line_6: [5,1,7,3,9],
  line_7: [5,11,7,13,9],
  line_8: [0,6,2,8,4],
  line_9: [10,6,12,8,14],
  line_10: [5,1,2,3,9],
  line_11: [5,11,12,13,9],
  line_12: [10,11,7,13,14],
  line_13: [0,1,7,3,4],
  line_14: [10,6,7,8,14],
  line_15: [0,6,7,8,4],
  line_16: [0,11,2,13,4],
  line_17: [10,1,12,3,14],
  line_18: [5,6,2,8,9],
  line_19: [5,6,12,8,9],
  line_20: [10,11,2,13,14]
};

const LINES_15 = {
  line_1: [5,6,7,8,9],
  line_2: [0,1,2,3,4],
  line_3: [10,11,12,13,14],
  line_4: [0,6,12,8,4],
  line_5: [10,6,2,8,14],
  line_6: [5,1,2,3,9],
  line_7: [5,11,12,13,9],
  line_8: [0,1,7,13,14],
  line_9: [10,11,7,3,4],
  line_10: [5,11,7,3,9],
  line_11: [5,1,7,13,9],
  line_12: [0,6,7,8,4],
  line_13: [10,6,7,8,14],
  line_14: [0,6,2,8,4],
  line_15: [10,6,12,8,14]
};

const PAYTABLE = {
  3: { min: 2, name: 'sym3 (yellowcar)', vals: { 2: 5, 3: 25, 4: 250, 5: 5000 } },
  4: { min: 2, name: 'sym4 (greencar)', vals: { 2: 5, 3: 20, 4: 150, 5: 1000 } },
  5: { min: 2, name: 'sym5 (oldjerry)', vals: { 2: 5, 3: 20, 4: 150, 5: 1000 } },
  6: { min: 2, name: 'sym6 (petrol)', vals: { 2: 2, 3: 10, 4: 50, 5: 300 } },
  7: { min: 2, name: 'sym7 (spark)', vals: { 2: 2, 3: 10, 4: 50, 5: 300 } },
  8: { min: 3, name: 'sym8 (luggage)', vals: { 3: 5, 4: 25, 5: 200 } },
  9: { min: 3, name: 'sym9 (piston)', vals: { 3: 5, 4: 25, 5: 200 } },
  10: { min: 3, name: 'sym10 (rims)', vals: { 3: 3, 4: 10, 5: 50 } },
  11: { min: 3, name: 'sym11 (sterling)', vals: { 3: 3, 4: 10, 5: 50 } }
};

function checkWins(m, lines) {
  let wins = [];
  for (let lName in lines) {
    let cells = lines[lName];
    let syms = cells.map(idx => m[idx]);
    let s0 = syms[0];
    let count = 1;
    while (count < 5 && syms[count] === s0) count++;
    let pt = PAYTABLE[s0];
    if (pt && count >= pt.min) {
      wins.push({ line: lName, sym: s0, count, payout: pt.vals[count] });
    }
  }
  return wins;
}

function solveClean(targetLine, targetSym, matchCount, lines) {
  const lineCells = lines[targetLine];
  const fillerPool = [8, 9, 10, 11];
  for (let attempt = 0; attempt < 50000; attempt++) {
    let m = new Array(15).fill(0);
    for (let i = 0; i < matchCount; i++) {
      m[lineCells[i]] = targetSym;
    }
    for (let c = 0; c < 15; c++) {
      if (m[c] === 0) {
        let choices = fillerPool.filter(s => s !== targetSym);
        m[c] = choices[Math.floor(Math.random() * choices.length)];
      }
    }
    const wins = checkWins(m, lines);
    if (wins.length === 1 && wins[0].line === targetLine && wins[0].count === matchCount && wins[0].sym === targetSym) {
      return { ok: true, matrix: m, win: wins[0] };
    }
  }
  return { ok: false };
}

function getAssignedSymbols(totalLines) {
  const assigned = {};
  const symPool = [8, 9, 10, 11];
  let poolIdx = 0;
  for (let i = 1; i <= totalLines; i++) {
    const lKey = 'line_' + i;
    if (totalLines === 20) {
      if (i === 16) assigned[lKey] = 3;
      else if (i === 17) assigned[lKey] = 4;
      else {
        assigned[lKey] = symPool[poolIdx % symPool.length];
        poolIdx++;
      }
    } else {
      if (i === 1) assigned[lKey] = 3;
      else {
        assigned[lKey] = symPool[poolIdx % symPool.length];
        poolIdx++;
      }
    }
  }
  return assigned;
}

function mcpCall(toolName, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now() + Math.floor(Math.random() * 1000),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    const req = http.request(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(payload),
        'X-Autotest-User': AUTOTEST_USER
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          const resp = JSON.parse(d);
          if (resp.error) return reject(new Error(resp.error.message || JSON.stringify(resp.error)));
          if (resp.result && resp.result.content && resp.result.content[0] && resp.result.content[0].text) {
            resolve(JSON.parse(resp.result.content[0].text));
          } else {
            resolve(resp.result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse MCP response: ${d}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getRunStatus(runId) {
  return new Promise((resolve, reject) => {
    http.get(`${API_URL}/runs/${runId}`, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function waitForRunDone(runId, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const run = await getRunStatus(runId);
      if (['passed', 'failed', 'stopped'].includes(run.status)) {
        return run;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Run ${runId} timed out after ${timeoutMs}ms`);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    http.get(url, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      file.close();
      try { fs.unlinkSync(destPath); } catch (e) {}
      reject(err);
    });
  });
}

function convertWebmToMp4(inputWebm, outputMp4) {
  execSync(`"${FFMPEG}" -y -i "${inputWebm}" -c:v libopenh264 -pix_fmt yuv420p "${outputMp4}"`, { stdio: 'pipe' });
}

async function runTestCase(gameCode, lineNum, symCount, matrix, folderName) {
  const subFolder = symCount === 3 ? 'videos_3_symbols' : 'videos_5_symbols';
  const outMp4 = path.join(`d:/Game_slot/evidence/${folderName}/${subFolder}`, `winline_${lineNum}_${symCount}sym.mp4`);

  if (fs.existsSync(outMp4) && fs.statSync(outMp4).size > 100000) {
    const sz = fs.statSync(outMp4).size;
    console.log(`[${new Date().toLocaleTimeString()}] ALREADY EXISTS: ${outMp4} (${(sz / 1024 / 1024).toFixed(2)} MB), skipping.`);
    return { ok: true, lineNum, symCount, outMp4, mp4Size: sz };
  }

  const caseName = `${gameCode.toLowerCase()}-line-${lineNum}-${symCount}sym`;
  const caseYaml = `name: ${caseName}
description: "Kiểm tra winline ${lineNum} ${symCount} symbol với ${gameCode}"
steps:
  - open
  - spin:
      matrix: [${matrix.join(', ')}]
      looseBoard: true
  - wait:
      ms: 15000
  - waitIdle:
      labelsStable: true
  - expect:
      balanceLedger: true
      winMatchesServer: all
      idle: true
      noErrors: true
`;

  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Starting ${caseName} (attempt ${attempt})...`);
      const startResult = await mcpCall('start_run', {
        project: 'webgame_v2',
        games: [gameCode],
        target: 'release',
        headless: true,
        video: 'on',
        note: `Test line ${lineNum} ${symCount}sym ${gameCode}`,
        case_yaml: caseYaml,
        keep_going: true
      });

      const runId = startResult.id;
      const completedRun = await waitForRunDone(runId);

      if (completedRun.status !== 'passed') {
        throw new Error(`Run ${runId} ended with status ${completedRun.status}`);
      }

      let videoUrl = null;
      if (completedRun.cells && completedRun.cells.length > 0) {
        for (const cell of completedRun.cells) {
          if (cell.attachments) {
            const vAtt = cell.attachments.find(a => a.name === 'video');
            if (vAtt && vAtt.url) {
              videoUrl = vAtt.url.startsWith('http') ? vAtt.url : `http://192.168.0.200:4700${vAtt.url}`;
              break;
            }
          }
        }
      }

      if (!videoUrl) {
        throw new Error(`No video URL in passed run ${runId}`);
      }

      const tempWebm = path.join('d:/Game_slot', `temp_${runId}.webm`);
      const subFolder = symCount === 3 ? 'videos_3_symbols' : 'videos_5_symbols';
      const outMp4 = path.join(`d:/Game_slot/evidence/${folderName}/${subFolder}`, `winline_${lineNum}_${symCount}sym.mp4`);

      await downloadFile(videoUrl, tempWebm);
      convertWebmToMp4(tempWebm, outMp4);
      try { fs.unlinkSync(tempWebm); } catch (e) {}

      const mp4Size = fs.statSync(outMp4).size;
      console.log(`[${new Date().toLocaleTimeString()}] PASSED & SAVED: ${outMp4} (${(mp4Size / 1024 / 1024).toFixed(2)} MB)`);
      return { ok: true, lineNum, symCount, runId, outMp4, mp4Size };
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED ${caseName} (attempt ${attempt}): ${err.message}`);
      lastErr = err;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  return { ok: false, lineNum, symCount, error: lastErr.message };
}

async function runGame(gameConfig) {
  const { code, folderName, totalLines, serverCode } = gameConfig;
  console.log(`\n======================================================`);
  console.log(`STARTING AUTOMATED TEST FOR GAME: ${code} (${folderName})`);
  console.log(`Lines: ${totalLines}, serverCode: ${serverCode}`);
  console.log(`======================================================\n`);

  const linesDef = totalLines === 20 ? LINES_20 : LINES_15;
  const assignedSyms = getAssignedSymbols(totalLines);

  const evDir = path.join('d:/Game_slot/evidence', folderName);
  const v3Dir = path.join(evDir, 'videos_3_symbols');
  const v5Dir = path.join(evDir, 'videos_5_symbols');
  fs.mkdirSync(v3Dir, { recursive: true });
  fs.mkdirSync(v5Dir, { recursive: true });

  // Generate matrices
  console.log(`Generating clean single-winline matrices for ${totalLines} lines...`);
  const matrixClean = {
    game: code,
    folder: folderName,
    serverCode: serverCode,
    totalLines: totalLines,
    generatedAt: new Date().toISOString(),
    lines: {}
  };

  const tasks = [];
  for (let i = 1; i <= totalLines; i++) {
    const lKey = 'line_' + i;
    const sym = assignedSyms[lKey];
    const s3 = solveClean(lKey, sym, 3, linesDef);
    const s5 = solveClean(lKey, sym, 5, linesDef);

    if (!s3.ok || !s5.ok) {
      throw new Error(`Failed to solve clean matrix for ${lKey}`);
    }

    matrixClean.lines[lKey] = {
      line: i,
      symbol: sym,
      symbolName: PAYTABLE[sym].name,
      cells: linesDef[lKey],
      threeSymbols: {
        matrix: s3.matrix,
        payout: s3.win.payout
      },
      fiveSymbols: {
        matrix: s5.matrix,
        payout: s5.win.payout
      }
    };

    tasks.push({ lineNum: i, symCount: 3, matrix: s3.matrix, sym, payout: s3.win.payout });
    tasks.push({ lineNum: i, symCount: 5, matrix: s5.matrix, sym, payout: s5.win.payout });
  }

  fs.writeFileSync(path.join(evDir, 'matrix_clean.json'), JSON.stringify(matrixClean, null, 2), 'utf8');
  console.log(`Saved clean matrix to ${path.join(evDir, 'matrix_clean.json')}`);

  // Run tasks with concurrency 3
  const CONCURRENCY = 3;
  const results = [];
  let taskIndex = 0;

  async function worker(workerId) {
    while (taskIndex < tasks.length) {
      const currentTask = tasks[taskIndex++];
      console.log(`[Worker ${workerId}] Executing Line ${currentTask.lineNum} (${currentTask.symCount} symbols)...`);
      const res = await runTestCase(code, currentTask.lineNum, currentTask.symCount, currentTask.matrix, folderName);
      results.push({ ...currentTask, ...res });
    }
  }

  const workers = [];
  for (let w = 1; w <= CONCURRENCY; w++) {
    workers.push(worker(w));
  }
  await Promise.all(workers);

  // Generate EVIDENCE.md
  console.log(`\nGenerating EVIDENCE.md for ${folderName}...`);
  let md = `# Bằng Chứng Kiểm Thử Tự Động Winline - Game: ${folderName} (${code})\n\n`;
  md += `- **Mã game:** \`${code}\` (Server code: \`${serverCode}\`)\n`;
  md += `- **Tổng số paylines:** ${totalLines} lines\n`;
  md += `- **Môi trường:** Release Build (\`http://192.168.0.200:4700\`)\n`;
  md += `- **Người thực hiện:** \`MinhKhanh\`\n`;
  md += `- **Thời gian hoàn thành:** ${new Date().toLocaleString('vi-VN')}\n`;
  md += `- **Tiêu chí:** Single-Winline 100% (mỗi lượt quay chỉ nổ đúng 1 đường thắng mục tiêu), Đa dạng hóa Symbol (mỗi winline mang biểu tượng riêng biệt).\n\n`;

  md += `## 1. Kết quả kiểm thử Winline 3 Symbols (Quan sát 15s)\n\n`;
  md += `| Winline | Tọa độ ô | Symbol | Payout | File Video MP4 | Trạng thái |\n`;
  md += `| :---: | :--- | :---: | :---: | :--- | :---: |\n`;

  for (let i = 1; i <= totalLines; i++) {
    const lKey = 'line_' + i;
    const lData = matrixClean.lines[lKey];
    const r = results.find(x => x.lineNum === i && x.symCount === 3);
    const status = r && r.ok ? '✅ PASS' : '❌ FAIL';
    const link = `[winline_${i}_3sym.mp4](file:///d:/Game_slot/evidence/${folderName}/videos_3_symbols/winline_${i}_3sym.mp4)`;
    md += `| **Line ${i}** | \`[${lData.cells.join(', ')}]\` | \`${lData.symbolName}\` | ${lData.threeSymbols.payout} | ${link} | ${status} |\n`;
  }

  md += `\n## 2. Kết quả kiểm thử Winline 5 Symbols (Quan sát 15s)\n\n`;
  md += `| Winline | Tọa độ ô | Symbol | Payout | File Video MP4 | Trạng thái |\n`;
  md += `| :---: | :--- | :---: | :---: | :--- | :---: |\n`;

  for (let i = 1; i <= totalLines; i++) {
    const lKey = 'line_' + i;
    const lData = matrixClean.lines[lKey];
    const r = results.find(x => x.lineNum === i && x.symCount === 5);
    const status = r && r.ok ? '✅ PASS' : '❌ FAIL';
    const link = `[winline_${i}_5sym.mp4](file:///d:/Game_slot/evidence/${folderName}/videos_5_symbols/winline_${i}_5sym.mp4)`;
    md += `| **Line ${i}** | \`[${lData.cells.join(', ')}]\` | \`${lData.symbolName}\` | ${lData.fiveSymbols.payout} | ${link} | ${status} |\n`;
  }

  md += `\n## 3. Thư mục lưu trữ bằng chứng\n\n`;
  md += `- Thư mục gốc: [\`d:/Game_slot/evidence/${folderName}/\`](file:///d:/Game_slot/evidence/${folderName}/)\n`;
  md += `- Video 3 symbols: [\`d:/Game_slot/evidence/${folderName}/videos_3_symbols/\`](file:///d:/Game_slot/evidence/${folderName}/videos_3_symbols/)\n`;
  md += `- Video 5 symbols: [\`d:/Game_slot/evidence/${folderName}/videos_5_symbols/\`](file:///d:/Game_slot/evidence/${folderName}/videos_5_symbols/)\n`;
  md += `- Ma trận sạch: [\`matrix_clean.json\`](file:///d:/Game_slot/evidence/${folderName}/matrix_clean.json)\n`;

  fs.writeFileSync(path.join(evDir, 'EVIDENCE.md'), md, 'utf8');
  console.log(`Generated EVIDENCE.md at ${path.join(evDir, 'EVIDENCE.md')}`);
  console.log(`Completed testing for ${folderName}! All done.\n`);
}

async function main() {
  const targetGame = process.argv[2];
  const allGames = [
    { code: 'sGreenLigh', folderName: 'GreenLight', totalLines: 20, serverCode: 'n59240' },
    { code: 'sRally', folderName: 'Rally', totalLines: 20, serverCode: 'n59177' },
    { code: 'sVictory', folderName: 'Victory', totalLines: 20, serverCode: 'n55258' },
    { code: 'sDrgGold', folderName: 'DragonGold', totalLines: 20, serverCode: 'n57499' },
    { code: 'sSafariHea', folderName: 'SafariHeat', totalLines: 15, serverCode: 'n53989' },
    { code: 'sPantherMo', folderName: 'PantherMoon', totalLines: 15, serverCode: 'n55535' }
  ];

  const gamesToRun = targetGame ? allGames.filter(g => g.code.toLowerCase() === targetGame.toLowerCase() || g.folderName.toLowerCase() === targetGame.toLowerCase()) : allGames;

  for (const g of gamesToRun) {
    await runGame(g);
  }
}

main().catch(err => {
  console.error('Fatal error in runner:', err);
  process.exit(1);
});
