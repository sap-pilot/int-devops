const fs = require('fs');
const FormData = require('form-data');
const { responseInterceptor } = require('http-proxy-middleware');
const { logger } = require("./logger");
const { config } = require('../config');
const { extractMtar } = require('./mtar-extractor');
const { repoMan } = require('./repo-man');

/* http-proxy middleware */
const tmsProxyConfig = {
    target: config.tmsUrl,
    changeOrigin: true,
    selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()
    on: {
        proxyReq: (proxyReq, req, res) => {
            req.startTime = Date.now();
            const exchange = `[request] ${req.method} ${req.originalUrl}`;
            logger.info(exchange); // GET / -> http://www.example.com [200]
            logger.debug(`[request-headers]: ${JSON.stringify(req.headers, null, 2)}`);
            const uploadUrlPattern = /^\/v2\/files\/upload$/;
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
            } else if (req.body && typeof req.body == 'object') {
                // repost JSON request body
                const str = JSON.stringify(req.body,null,2);
                logger.debug(`[request-body]: ${str}`);
                proxyReq.setHeader('Content-Type', `application/json`);
                proxyReq.setHeader('Content-Length', str.length);
                proxyReq.write(str);
                proxyReq.end();
            }
        },
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
            // log original request and proxied request info
            const durationMs = Date.now() - req.startTime;
            const exchange = `[response] ${req.method} ${req.originalUrl} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} [${proxyRes.statusCode}] (${durationMs}ms)`;
            logger.info(exchange); // GET / -> http://www.example.com [200]
            logger.debug(`[response-headers]: ${JSON.stringify(res.getHeaders(), null, 2)}`);
            const response = responseBuffer.toString('utf8');
            let responseObj = null;
            try {
                responseObj = JSON.parse(response);
            } catch (e) {
                // not able to parse response, nothing to do    
            }
            // pretty print response
            const nodesUrlPattern = /^\/v2\/nodes$/;
            if (config.logPretty && !proxyRes.req.path.match(nodesUrlPattern) && responseObj) {
                logger.debug(`[response-body]: ${JSON.stringify(responseObj, null, 2)}`); // pretty print json object
            } else if (response) {
                logger.debug(`[response-body]: ${response}`); // log raw response body
            }
            // try renaming uploaded file to fileId
            if (req.file && responseObj && responseObj.fileId) {
                try {
                    const newFileName = `${config.uploadPath}/${responseObj.fileId}`;
                    logger.info(`renaming ${req.file.path} to ${newFileName}`);
                    fs.renameSync(req.file.path, newFileName);
                } catch (e) {
                    logger.error(`failed to rename: ${e}`);
                }
            }
            const exportUrlPattern = /^\/v2\/nodes\/export$/;
            if ( proxyRes.req.path.match(exportUrlPattern) ) {
                const fileId = req.body && req.body.entries && req.body.entries.length > 0? req.body.entries[0].uri : null;
                const trNode = req.body? req.body.nodeName : '';
                const namedUser = req.body? req.body.namedUser : null;
                const userInfo = namedUser? {
                    "name":namedUser.split("@")[0],
                    "email":namedUser
                }:null;
                const trDesc = responseObj? responseObj.transportRequestDescription : 'n/a';
                const trId =   responseObj? responseObj.transportRequestId : '000';
               
                //const trNodeId = responseObj && responseObj.queueEntries && responseObj.queueEntries.length > 0? responseObj.queueEntries[0].nodeId : '';
                if (!fileId) {
                    logger.warn(`no file id found from export request: ${JSON.stringify(req.body,null,2)}`);
                } else {
                    const mtarFile = `${config.uploadPath}/${fileId}`;
                    const destPath = `${config.tmpPath}/${fileId}`;
                    if (!fs.existsSync(mtarFile)) {
                        logger.warn(`abort mtar extraction and repo update - no mtarFile exists at '${mtarFile}'`);
                    } else {
                        const branch = repoMan.findBranch(trNode);
                        logger.info(`extracting mtar '${mtarFile}' to '${destPath}' and pushing to '${branch}'`);
                        extractMtar(mtarFile, destPath)
                            .then( () => repoMan.pull(branch) )
                            .then( () => repoMan.copyFiles(destPath, branch) )
                            .then( () => repoMan.commit(branch,`${trId}-${trDesc}`,userInfo) )
                            .then( () => repoMan.push(branch) )
                            .catch(error => {
                                logger.error(`error occured while extracting '${mtarFile}' and pushing to '${branch}': ${error}`)
                            });
                    }
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