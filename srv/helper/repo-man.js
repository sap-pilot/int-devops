const { config } = require('../config');
const { logger } = require('./logger');
const fs = require("fs");
const path = require("path");
const { execSync } = require('child_process');

class RepoMan {
    constructor() {
        if (RepoMan.instance) {
            return RepoMan.instance;
        }
        RepoMan.instance = this;
        this._initialized = false;
        let repoStr = JSON.stringify(config.repo,null,2);
        const redactedStr = this._redactUrl(repoStr);
        const startTime =  Date.now();
        logger.info(`initializing RepoMan with config: ${redactedStr}`);
        this._repoUrl = config.repo.url;
        this._branches = config.repo.branches;
        this._nodeMapping = config.repo.nodeMapping;
        this._rootFolder = path.join(__dirname, '../../', config.workPath);
        logger.info(`repo rootFolder: '${this._rootFolder}'`);
        if (!fs.existsSync(this._rootFolder)){
            logger.info(`creating repo rootFolder '${this._rootFolder}'`);
            fs.mkdirSync(this._rootFolder);
        }
        if (!this._repoUrl) {
            logger.error(`REPO_URL not specified, will skip all repo operation`);
            return;
        }
        if (!this._branches) {
            logger.error(`REPO_BRANCHES not specified, will skip all repo operation`);
            return;
        }
        for (const branch of this._branches) {
            let folder = `${this._rootFolder}/${branch}`;
            if (!fs.existsSync(`${folder}`)) {
                this._git(`clone -b ${branch} ${this._repoUrl} ${branch}`, this._rootFolder);
                // config user name and email
                this._git(`config user.name "int-devops"`, folder);
                this._git(`config user.email "int-devops@sap-test.de"`, folder);
            }
        }
        const durationMs = Date.now() - startTime;
        logger.info(`completed initialization of RepoMan, takes time: ${durationMs}ms`);
        this._initialized = true;
    }
    findBranch(tmsNodeName) {
        const branch = this._nodeMapping[tmsNodeName];
        if (branch) {
            logger.debug(`found branch for tms node: ${tmsNodeName} -> ${branch}`);
            return branch;
        } else {
            logger.warn(`branch not found for tms node: ${tmsNodeName}, use dev branch instead`);
            return 'dev';
        }
    }
    copyFiles(srcFolder, branch) {
        if (!this._initialized) {
            logger.warn(`repo not initialized, abort copying files`);
            return;
        }
        const destFolder = `${this._rootFolder}/${branch}`;
        //const cmd = `cp -rf ${srcFolder}/* ${destFolder}`;
        const cmd = `rsync -art ${srcFolder}/* ${destFolder} --exclude /META-INF`;
        logger.info(cmd)
        try {
            const result = execSync(`${cmd}`);
            logger.debug(`completed '${cmd}:\n${result}`);
        } catch (error) {
            logger.error(`error with '${cmd}':\n${error}`);
        }
    }
    pull(branch) {
        if (!this._initialized) {
            logger.warn(`repo not initialized, abort pull`);
            return;
        }
        this._git(`reset --hard`,`${this._rootFolder}/${branch}`)
        this._git(`pull`,`${this._rootFolder}/${branch}`)
    }
    commit(branch, message) {
        if (!this._initialized) {
            logger.warn(`repo not initialized, abort commit`);
            return;
        }
        this._git(`add -A`,`${this._rootFolder}/${branch}`)
        this._git(`commit -m "${message}"`,`${this._rootFolder}/${branch}`)
    }
    push(branch) {
        if (!this._initialized) {
            logger.warn(`repo not initialized, abort push`);
            return;
        }
        //this._git(`push --force`,`${this._rootFolder}/${branch}`)
        this._git(`push`,`${this._rootFolder}/${branch}`)
    }
    _redactUrl(url) {
        if (!config.redactAuthHeader)
            return url;
        const newUrl = url.replace(/\/\/(.*?)\@/, "//[redacted]@");
        return newUrl;
    }
    _git(gitCmd, targetDir) {
        const startTime =  Date.now();
        const redactedCmd = this._redactUrl(gitCmd);
        logger.info(`git ${redactedCmd}`)
        try {
            const result = execSync(`git ${gitCmd}`, { cwd: targetDir });
            const durationMs = Date.now() - startTime;
            logger.debug(`completed 'git ${redactedCmd}' (duration: ${durationMs}ms):\n${result}`);
        } catch (error) {
            logger.error(`error with 'git ${redactedCmd}':\n${error}`);
        }
    }
}

const repoMan = new RepoMan();
Object.freeze(repoMan);

module.exports = { repoMan };