const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const { logger } = require("./common/logger");
let buildInfo = { "version": "N/A", "built": "N/A" };
try { buildInfo = require("./build-info.json") } catch (e) { logger.warn(`build-info.json not found`) }

const app = express();
const port = process.env.PORT || 4004;

/* http-proxy middleware */
const tmsProxyConfig = {
    // target:  'https://services.odata.org',
    // pathRewrite: { '^/': '/northwind/northwind.svc/' },
    target: 'https://transport-service-app-backend.ts.cfapps.us10.hana.ondemand.com', // target to be determined by destination via router function
    changeOrigin: true,
    selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()
    // router: (req) => {
    //     const destination = req.destination;
    //     return destination.url;
    // },
    on: {
        proxyReq: (proxyReq, req, res) => {
            req.startTime = Date.now();
            const exchange = `[request] ${req.method} ${req.path}`;
            logger.info(exchange); // GET / -> http://www.example.com [200]
        },
        // proxyRes: (proxyRes, req, res) => {
        //     const durationMs = Date.now() - req.startTime;
        //     logger.info(`tms request url: ${req.url}, response code: ${proxyRes.statusCode}, duration(ms): ${durationMs}`);
        //     if (proxyRes.statusCode >= 500) {
        //         logger.error(`tms response code: ${proxyRes.statusCode}, request url: ${req.url}, req-headers: ${JSON.stringify(req.headers)}, res-headers: ${JSON.stringify(res.getHeaders())}`);
        //     } else if (proxyRes.statusCode >= 300) {
        //         logger.warn(`tms response code: ${proxyRes.statusCode}, request url: ${req.url}, req-headers: ${JSON.stringify(req.headers)}, res-headers: ${JSON.stringify(res.getHeaders())}`);
        //     }
        // },
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
            // log original request and proxied request info
            const durationMs = Date.now() - req.startTime;
            const exchange = `[response] ${req.method} ${req.path} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} [${proxyRes.statusCode}] (${durationMs}ms)`;
            logger.info(exchange); // GET / -> http://www.example.com [200]
            //logger.warn(`[headers] req-headers: ${JSON.stringify(req.headers)}, res-headers: ${JSON.stringify(res.getHeaders())}`);

            // log complete response
            const response = responseBuffer.toString('utf8');
            logger.debug(response); // log response body

            return responseBuffer;
        }),
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