// Integration DevOps AppRouter (main)
const approuter = require('@sap/approuter');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// custom libraries
const { logger } = require('./lib/logger');
const { tmsProxyConfig } = require('./lib/tms-proxy');
const { config } = require('./config');

// upload handling
const multer = require('multer')
const upload = multer({ dest: config.uploadPath });

let buildInfo = { "version": "N/A", "build": "N/A", "commit": "N/A"};
try { buildInfo = require("./dist/ui/build-info.json") } catch (e) { logger.warn(`failed to load build-info.json: ${e}`) }

const port = process.env.PORT || 4004;

const app = approuter();

app.beforeRequestHandler.use('/public/health', (req, res) => {
    res.end('ok');
});

app.beforeRequestHandler.use('/public/version', (req, res) => {
    buildInfo.process = process.versions;
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify(buildInfo,null,2));
});

// create tms proxy with file upload handling
const tmsProxy = createProxyMiddleware(tmsProxyConfig);
// at /tms path: handle file upload -> handle json body (export) -> then do tms-proxy
const compose = (...middlewares) => (req, res, next) => {
    const execute = (index) => {
      if (index >= middlewares.length) {
        return next();
      }
      middlewares[index](req, res, () => execute(index + 1));
    };
    execute(0);
  };
  
const combinedMiddleware = compose(upload.single('file'), express.json(), tmsProxy);

app.beforeRequestHandler.use('/tms', combinedMiddleware);

// app.listen(port, () => {
//     logger.info(`server ${buildInfo.version} (build: ${buildInfo.build}) listening at http://localhost:${port}`);
// });
app.start({
    port: port
})

logger.info(`started approuter at http://localhost:${port}`);