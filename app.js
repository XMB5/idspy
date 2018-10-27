if (process.env.IDSPY_UPGRADE && process.getuid() !== 0) {
    let args = process.env.DEBUG ? process.argv.concat(process.env.DEBUG): process.argv;
    require('kexec')('pkexec', args);
}

if (process.argv[2]) {
    process.env.DEBUG = process.argv[2];
}

const net = require('net');
const debug = require('debug')('idspy:app');
const readline = require('readline');
const UsbmuxdInterceptor = require('./interceptor.js');

let server = net.createServer(socket => {
    debug('new socket');
    let realSocket = new net.Socket();
    realSocket.connect('/var/run/usbmuxx', () => debug('realSocket connected'));

    let interceptor = new UsbmuxdInterceptor(data => socket.write(data), data => realSocket.write(data));

    realSocket.on('data', data => {
        debug('interceptToClient data len', data.length);
        interceptor.interceptToClient(data);
    });
    realSocket.on('close', () => {
        debug('realSocket closed');
        socket.destroy()
    });

    socket.on('data', data => {
        debug('interceptToDaemon data len', data.length);
        interceptor.interceptToDaemon(data);
    });
    socket.on('close', () => {
        debug('socket closed');
        realSocket.destroy();
    })
});
server.listen({
    path: '/var/run/usbmuxd',
    readableAll: true,
    writableAll: true
}, () => debug('listening'));

function cleanup () {
    server.close(() => {
        debug('server closed');
        process.exit();
    });
}

process.on('SIGINT', cleanup);

readline.createInterface(process.stdin, process.stdout).on('line', line => {
    if (line === 'stop') {
        cleanup();
    }
});