const { spawnSync } = require('child_process');
const { logger } = require("./logger");

/**
 * execute command synchronously at os level
 * 
 * @param {string} cmd command to execute
 * @param {string} args string argument to pass to command
 * @param {string} path working path to execute this command 
 * @returns {string} stdout result
 * @throws {Error} if result.error or process status code != 0
 */
const command = function(cmd, args, path){
    const startTime = Date.now();
    logger.info(`${path} > ${cmd} ${args}'`);
    //const result = execSync(`./srv/helper/mtar-extractor.sh ${mtarFile} ${destDir}`);
    const result = spawnSync(cmd, args.split(' '), {shell: true, cwd: path});
    const durationMs = Date.now() - startTime;
    logger.debug(`completed: '${cmd} ${args}', takes time ${durationMs} ms`);
    const stdout = result && result.stdout? result.stdout.toString() : null;
    const stderr = result && result.stderr? result.stderr.toString() : null;
    if (stdout) {
        logger.debug(`stdout: ${stdout}`);
    }
    if (stderr) {
        logger.debug(`stderr: ${stderr}`);
    }
    if (result.error) {
        throw new Error(result.error);
    } else if (result.status != 0) {
        throw new Error(`exit code [${result.status}] from '${cmd} ${args}''`)
    } else {
        return stdout;
    }
}

module.exports = { command };