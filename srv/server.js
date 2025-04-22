const express = require('express');
const multer = require('multer')
const uploadPath = './upload';
const upload = multer({ dest: uploadPath });
const fs = require('fs');
const FormData = require('form-data');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

// logging and branding module
const { logger } = require("./helper/logger");
let buildInfo = { "version": "N/A", "build": "N/A" };
try { buildInfo = require("./build-info.json") } catch (e) { logger.warn(`build-info.json not found`) }

// env variables
const prettyResponse = process.env.PRETTY_RESPONSE != "false";
const redactAuthHeader = !process.env.REDACT_AUTH_HEADER || process.env.REDACT_AUTH_HEADER != "false" ;
const tmsUrl = process.env.TMS_URL ? process.env.TMS_URL : 'https://transport-service-app-backend.ts.cfapps.us10.hana.ondemand.com'
//const tmsUrl = 'https://int-devops.free.beeceptor.com';
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
            if (redactAuthHeader) {
                const redactedHeaders = {};
                if (req.headers) {
                    for (const [key, value] of Object.entries(req.headers)) {
                        redactedHeaders[key] = key.toLowerCase() == 'authorization'? '[redacted]' : value;
                    };
                }
                logger.debug(`[req-headers]: ${JSON.stringify(redactedHeaders, null, 2)}`);
            } else {
                logger.debug(`[req-headers]: ${JSON.stringify(req.headers, null, 2)}`);
            }
            if (req.file) {
                const formData = new FormData();
                //append other form fields to FormData
                for (const key in req.body) {
                    formData.append(key, req.body[key]);
                }
                const buffer = fs.readFileSync(req.file.path);
                formData.append('file', buffer, req.file.originalname);
                //formData.append('file', fs.createReadStream(req.file.path), req.file.originalname);
                //formData.append('file', new Blob([fs.readFileSync(req.file.path)]), req.file.originalname);
                proxyReq.setHeader('Content-Type', `multipart/form-data; boundary=${formData._boundary}`);
                //proxyReq.setHeader('Content-Type', undefined);
                proxyReq.setHeader('Content-Length', formData.getLengthSync());
                // upload the file to tms
                formData.pipe(proxyReq);
                //proxyReq.write(formData);
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
            if (prettyResponse && !proxyRes.req.path.match(nodesUrlPattern) && obj) {
                logger.debug(`[res-body]: ${JSON.stringify(obj, null, 2)}`); // pretty print json object
            } else if (response) {
                logger.debug(`[res-body]: ${response}`); // log raw response body
            }
            // try renaming uploaded file 
            if (req.file && obj && obj.fileId) {
                try {
                    const newFileName = `${uploadPath}/${obj.fileId}`;
                    logger.info(`renaming ${req.file.path} to ${newFileName}`);
                    fs.renameSync(req.file.path, newFileName);
                } catch (e) {
                    logger.error(`failed to rename: ${e}`);
                }
            }
            return responseBuffer;
        }),
        error: (err, req, res) => {
            logger.error(`failed to proxy tms request: ${err}`);
        }
    }
};

app.get('/health', (req, res) => {
    res.send('ok');
});

app.get('/version', (req, res) => {
    const info = {"version":buildInfo,"process":process.versions};
    res.setHeader("Content-Type","application/json");
    res.send(JSON.stringify(info,null,2));
});

const proxy = createProxyMiddleware(tmsProxyConfig);
app.use('/tms', upload.single('file'), proxy);

app.use(express.static('./app/webapp'));

app.listen(port, () => {
    logger.info(`server ${buildInfo.version} (build: ${buildInfo.build}) listening at http://localhost:${port}`);
});