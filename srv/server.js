const express = require('express');
const multer = require('multer')
const uploadPath = './upload';
const upload = multer({ dest: uploadPath });
const fs = require('fs');
const FormData = require('form-data');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

// logging and branding module
const { logger } = require("./common/logger");
let buildInfo = { "version": "N/A", "built": "N/A" };
try { buildInfo = require("./build-info.json") } catch (e) { logger.warn(`build-info.json not found`) }

// env variables
const prettyResponse = process.env.PRETTY_RESPONSE != "false";
const tmsUrl = process.env.TMS_URL ? process.env.TMS_URL : 'https://transport-service-app-backend.ts.cfapps.us10.hana.ondemand.com'
const port = process.env.PORT || 4004;

const app = express();

/* http-proxy middleware */
const tmsProxyConfig = {
    target: tmsUrl, 
    changeOrigin: true,
    selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()
    on: {
        proxyReq: (proxyReq, req, res) => {
            req.startTime = Date.now();
            const exchange = `[request] ${req.method} ${req.path}`;
            logger.info(exchange); // GET / -> http://www.example.com [200]
            logger.debug(`[req-headers]: ${JSON.stringify(req.headers, null, 2)}`);
            if (req.file) {
                const formData = new FormData();
                formData.append('file', req.file.path, req.file.originalname);
                // append other form fields to FormData
                for (const key in req.body) {
                    formData.append(key, req.body[key]);
                }
                proxyReq.setHeader('Content-Type', `multipart/form-data; boundary=${formData._boundary}`);
                proxyReq.setHeader('Content-Length', formData.getLengthSync());
                // upload the file to tms
                formData.pipe(proxyReq);
            }
        },
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
            // log original request and proxied request info
            const durationMs = Date.now() - req.startTime;
            const exchange = `[response] ${req.method} ${req.path} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} [${proxyRes.statusCode}] (${durationMs}ms)`;
            logger.info(exchange); // GET / -> http://www.example.com [200]
            logger.debug(`[res-headers]: ${JSON.stringify(res.getHeaders(), null, 2)}`);
            const response = responseBuffer.toString('utf8');
            let obj = null;
            try {
                obj = JSON.parse(response);
            } catch (e) {
                // not able to parse response, nothing to do    
            }
            // pretty print response
            const nodesUrlPattern = /^\/v2\/nodes$/;
            if (prettyResponse && !proxyRes.req.path.match(nodesUrlPattern) && obj ) {
                logger.debug(JSON.stringify(obj,null,2)); // pretty print json object
            } else if (response) {
                logger.debug(response); // log raw response body
            }
            // try renaming uploaded file 
            if (req.file && obj) {
                 try {
                    const newFileName = `${uploadPath}/${obj.fileId}-${obj.fileName}`;
                    logger.info(`renaming ${req.file.path} to ${newFileName}`);
                    fs.renameSync(req.file.path, newFileName);
                 } catch (e) {
                    logger.error(`failed to rename`, e);
                 }
            }
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

const proxy = createProxyMiddleware(tmsProxyConfig);
//app.use('/v2/files/upload', upload.single('file'), proxy);
app.use('/', upload.single('file'), proxy);

app.listen(port, () => {
    logger.info(`server ${buildInfo.version} (build: ${buildInfo.build}) listening at http://localhost:${port}`);
});