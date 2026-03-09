const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

const FILES_DIR = path.join(__dirname, 'tezfiles');
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR);

const defaults = {
    'HELLO.TXT':  'Hello from FAT12!\n',
    'NOTES.TXT':  'TEZ_OS development notes:\n- bootloader done\n- FAT12 working\n- TEZ lang v0.1\n',
    'README.TXT': 'TEZ_OS v0.1\nA 32-bit OS written from scratch.\ntype hlp for commands.\n',
};
for (const [name, content] of Object.entries(defaults)) {
    const p = path.join(FILES_DIR, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, content);
}

function safeFilename(name) {
    // only allow alphanumeric, dot, underscore — no path traversal
    return /^[A-Za-z0-9._\-]{1,20}$/.test(name) ? name.toUpperCase() : null;
}

function calcSafe(expr) {
    const allowed = /^[\d\s\+\-\*\/\%\(\)\.\,a-z]+$/i;
    const fns = ['sin','cos','tan','sqrt','abs','log','exp','floor','ceil','round','PI','E'];
    if (!allowed.test(expr)) throw new Error('invalid characters in expression');

    let safe = expr
        .replace(/\bsin\b/g,   'Math.sin')
        .replace(/\bcos\b/g,   'Math.cos')
        .replace(/\btan\b/g,   'Math.tan')
        .replace(/\bsqrt\b/g,  'Math.sqrt')
        .replace(/\babs\b/g,   'Math.abs')
        .replace(/\blog\b/g,   'Math.log')
        .replace(/\bexp\b/g,   'Math.exp')
        .replace(/\bfloor\b/g, 'Math.floor')
        .replace(/\bceil\b/g,  'Math.ceil')
        .replace(/\bround\b/g, 'Math.round')
        .replace(/\bpi\b/gi,   'Math.PI')
        .replace(/\be\b/g,     'Math.E')
        .replace(/\*\*/g,      '**');  // already valid in JS

    if (/[a-zA-Z](?!ath\.)/.test(safe.replace(/Math\.\w+/g, ''))) {
        throw new Error('unknown identifier');
    }

    const result = Function('"use strict"; return (' + safe + ')')();
    if (typeof result !== 'number') throw new Error('not a number');
    return result;
}

app.post('/api/cmd', (req, res) => {
    const raw  = (req.body.cmd || '').trim();
    const parts = raw.split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    try {
        switch (cmd) {

        case 'hlp': {
            res.json({ type: 'table', rows: [
                { cmd: 'hlp',           desc: 'show this help' },
                { cmd: 'sinf',          desc: 'system info' },
                { cmd: 'room',          desc: 'list files on disk' },
                { cmd: 'show <file>',   desc: 'print file contents' },
                { cmd: 'calc <expr>',   desc: 'evaluate math expression' },
                { cmd: 'time',          desc: 'current server time' },
            ]});
            break;
        }

        case 'sinf': {
            res.json({ type: 'neofetch', lines: [
                { label: 'OS',      value: 'TEZ_OS v0.1' },
                { label: 'Arch',    value: 'x86 32-bit' },
                { label: 'Kernel',  value: 'JZA kernel' },
                { label: 'Boot',    value: 'custom bootloader' },
                { label: 'FS',      value: 'FAT12' },
                { label: 'Display', value: 'VGA text 80x25' },
                { label: 'Input',   value: 'PS/2 keyboard' },
                { label: 'Server',  value: `Node.js ${process.version} / Express` },
            ]});
            break;
        }

        case 'room': {
            const entries = fs.readdirSync(FILES_DIR).map(name => {
                const size = fs.statSync(path.join(FILES_DIR, name)).size;
                return { name, size };
            });
            res.json({ type: 'room', entries });
            break;
        }

        case 'show': {
            if (!args[0]) { res.json({ type: 'error', msg: 'usage: show <filename>' }); break; }
            const fname = safeFilename(args[0]);
            if (!fname) { res.json({ type: 'error', msg: 'invalid filename' }); break; }
            const fpath = path.join(FILES_DIR, fname);
            if (!fs.existsSync(fpath)) { res.json({ type: 'error', msg: `file not found: ${fname}` }); break; }
            const content = fs.readFileSync(fpath, 'utf8');
            res.json({ type: 'text', text: content });
            break;
        }

        case 'calc': {
            if (!args.length) { res.json({ type: 'error', msg: 'usage: calc <expression>' }); break; }
            const expr = args.join(' ');
            const result = calcSafe(expr);
            const formatted = Number.isInteger(result)
                ? result.toString()
                : parseFloat(result.toFixed(8)).toString();
            res.json({ type: 'calc', expr, result: formatted });
            break;
        }

        case 'time': {
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;
            res.json({ type: 'time', time: timeStr, date: dateStr, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
            break;
        }

        case 'clr': {
            res.json({ type: 'clear' });
            break;
        }

        default:
            res.json({ type: 'error', msg: `unknown command: ${cmd}. type 'hlp' for help.` });
        }
    } catch (err) {
        res.json({ type: 'error', msg: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`TEZ_OS server running at http://localhost:${PORT}`);
});
