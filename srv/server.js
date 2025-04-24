// Integration DevOps server (main)
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// custom helpers
const { logger } = require('./helper/logger');
const { tmsProxyConfig } = require('./helper/tms-proxy');
const { config } = require('./config');

// upload handling
const multer = require('multer')
const upload = multer({ dest: config.uploadPath });

let buildInfo = { "version": "N/A", "build": "N/A" };
try { buildInfo = require("./build-info.json") } catch (e) { logger.warn(`failed to load build-info.json: ${e}`) }

const port = process.env.PORT || 4004;
const app = express();

app.get('/health', (req, res) => {
    res.send('ok');
});

app.get('/version', (req, res) => {
    const info = {"version":buildInfo,"process":process.versions};
    res.setHeader("Content-Type","application/json");
    res.send(JSON.stringify(info,null,2));
});

// create tms proxy with file upload handling
const tmsProxy = createProxyMiddleware(tmsProxyConfig);
// at /tms path: handle file upload -> handle json body (export) -> then do tms-proxy
app.use('/tms', upload.single('file'), express.json(), tmsProxy);

app.use(express.static('./ui/webapp'));

app.listen(port, () => {
    logger.info(`server ${buildInfo.version} (build: ${buildInfo.build}) listening at http://localhost:${port}`);
});