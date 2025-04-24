const { config } = require('../config');
const { logger } = require('./logger');
const { command } = require('./command');
const fs = require("fs");


class RepoMan {
    constructor() {
        if (RepoMan.instance) {
            return RepoMan.instance;
        }
        RepoMan.instance = this;
        this._initialized = false;
        const startTime =  Date.now();
        logger.info(`initializing RepoMan at: ${config.repo.url}`);
        this._repoUrl = config.repo.url;
        this._branches = config.repo.branches;
        this._nodeMapping = config.repo.nodeMapping;
        this._rootFolder = config.workPath;
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
                // this._git(`config user.name "int-devops"`, folder);
                // this._git(`config user.email "int-devops@sap-test.de"`, folder);
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
            throw new Error(`repo not initialized, abort copying files`);
        }
        const destFolder = `${this._rootFolder}/${branch}`;
        //const cmd = `cp -rf ${srcFolder}/* ${destFolder}`;
        const cmd = 'rsync';
        const args = `-art ${srcFolder}/* ${destFolder} --exclude /META-INF --exclude ExportInformation.info`;
        command(cmd, args, config.tmpPath);
    }
    pull(branch) {
        if (!this._initialized) {
            throw new Error(`repo not initialized, abort pull`);
        }
        this._git(`reset --hard`,`${this._rootFolder}/${branch}`)
        this._git(`clean -fd`,`${this._rootFolder}/${branch}`)
        this._git(`pull`,`${this._rootFolder}/${branch}`)
    }
    commit(branch, message, user) {
        if (!this._initialized) {
            throw new Error(`repo not initialized, abort commit`);
            return;
        }
        let dir = `${this._rootFolder}/${branch}`;
        if (user) {
            this._git(`config user.name "${user.name}"`, dir);
            this._git(`config user.email "${user.email}"`, dir);
        } else {
            // revert to default user
            this._git(`config user.name "int-devops"`, dir);
            this._git(`config user.email "int-devops@sap-test.de"`, dir);
        }
        this._git(`add -A`,dir)
        this._git(`commit -m "${message}"`,dir)
    }
    push(branch) {
        if (!this._initialized) {
            throw new Error(`repo not initialized, abort push`);
            return;
        }
        //this._git(`push --force`,`${this._rootFolder}/${branch}`)
        this._git(`push`,`${this._rootFolder}/${branch}`)
    }
    _git(gitCmd, targetDir) {
        command('git', gitCmd, targetDir);
    }
}

const repoMan = new RepoMan();
Object.freeze(repoMan);

module.exports = { repoMan };