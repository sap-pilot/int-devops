const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { logger } = require("./common/logger");
let buildInfo = {"version":"N/A","built":"N/A"};
try { buildInfo = require("./build-info.json") } catch (e) { logger.warn(`build-info.json not found`) }

const app = express();
const port = process.env.PORT || 4004;

/* http-proxy middleware */
const tmsProxyConfig = {
    target: 'https://services.odata.org', // target to be determined by destination via router function
    changeOrigin: true,
    pathRewrite: { '^/': '/northwind/northwind.svc/' },
    // router: (req) => {
    //     const destination = req.destination;
    //     return destination.url;
    // },
    on: {
        proxyReq: (proxyReq, req, res) => {
            req.startTime = Date.now();
        },
        proxyRes: (proxyRes, req, res) => {
            const durationMs = Date.now() - req.startTime;
            logger.info(`tms request url: ${req.url}, response code: ${proxyRes.statusCode}, duration(ms): ${durationMs}`);
            if (proxyRes.statusCode >= 500) {
                logger.error(`tms response code: ${proxyRes.statusCode}, request url: ${req.url}, req-headers: ${JSON.stringify(req.headers)}, res-headers: ${JSON.stringify(res.getHeaders())}`);
            } else if (proxyRes.statusCode >= 300) {
                logger.warn(`tms response code: ${proxyRes.statusCode}, request url: ${req.url}, req-headers: ${JSON.stringify(req.headers)}, res-headers: ${JSON.stringify(res.getHeaders())}`);
            }
        },
        error: (err, req, res) => {
            logger.error(err);
        }
    }
};

app.get('/health', (req, res) => {
    res.send('ok');
});

app.get('/build-info', (req, res) => {
    res.send(JSON.stringify(buildInfo));
});


app.use('/', createProxyMiddleware(tmsProxyConfig));

app.listen(port, () => {
    logger.info(`server ${buildInfo.version} (build: ${buildInfo.build}) listening at http://localhost:${port}`);
});