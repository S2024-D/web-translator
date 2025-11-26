const http = require('http');
const fs = require('fs');
const path = require('path');
const translateHandler = require('./api/translate.js');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    // API 요청 처리
    if (req.url === '/api/translate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            req.body = JSON.parse(body);

            // Vercel 스타일 res 객체 확장
            res.status = (code) => {
                res.statusCode = code;
                return res;
            };
            res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            };

            await translateHandler(req, res);
        });
        return;
    }

    // 정적 파일 서빙
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║       Web Translator - Local Server        ║
╠════════════════════════════════════════════╣
║  서버 실행 중: http://localhost:${PORT}        ║
║  종료: Ctrl + C                            ║
╚════════════════════════════════════════════╝
`);
});
