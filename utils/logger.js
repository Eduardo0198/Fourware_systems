function buildPrefix(level) {
    return `[${new Date().toISOString()}] [${level}]`;
}

function info(...args) {
    console.log(buildPrefix('INFO'), ...args);
}

function error(...args) {
    console.error(buildPrefix('ERROR'), ...args);
}

module.exports = {
    info,
    error
};
