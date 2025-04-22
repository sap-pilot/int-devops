const fs = require('fs');
const FormData = require('form-data');
const { responseInterceptor } = require('http-proxy-middleware');
const { logger } = require("./logger");
const { config } = require('../config');

/* http-proxy middleware */
const tmsProxyConfig = {
    target: config.tmsUrl,
    changeOrigin: true,
    selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()
    on: {
        proxyReq: (proxyReq, req, res) => {
            req.startTime = Date.now();
            const exchange = `[request] ${req.method} ${req.path}`;
            logger.info(exchange); // GET / -> http://www.example.com [200]
            if (config.redactAuthHeader) {
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
            if (config.prettyResponse && !proxyRes.req.path.match(nodesUrlPattern) && obj) {
                logger.debug(`[res-body]: ${JSON.stringify(obj, null, 2)}`); // pretty print json object
            } else if (response) {
                logger.debug(`[res-body]: ${response}`); // log raw response body
            }
            // try renaming uploaded file 
            if (req.file && obj && obj.fileId) {
                try {
                    const newFileName = `${config.uploadPath}/${obj.fileId}`;
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

module.exports = { tmsProxyConfig };