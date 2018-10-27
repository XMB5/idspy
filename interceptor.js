const EventEmitter = require('events');
const plist = require('plist');

const USBMUXD_HEADER_LENGTH = 16;

const STATE_WAITING_FOR_HEADER = 0;
const STATE_WAITING_FOR_MESSAGE = 1;
const STATE_STREAMING = 2;

class DynamicBuffer {

    constructor () {
        this.buffers = [];
        this.available = 0;
    }

    push (buffer) {
        this.buffers.push(buffer);
        this.available += buffer.length;
    }

    readBytes (length) {
        if (this.available < length) {
            return null;
        }

        let parts = [];
        let currentLen = 0;

        while(currentLen < length) {

            let buffer = this.buffers[0];
            let lengthNeeded = length - currentLen;

            if (buffer.length > lengthNeeded) {
                parts.push(buffer.slice(0, lengthNeeded));
                this.buffers[0] = buffer.slice(lengthNeeded);
                currentLen += lengthNeeded;

            } else {
                parts.push(buffer);
                currentLen += buffer.length;
                this.buffers.shift();
            }
        }

        this.available -= length;
        return Buffer.concat(parts, length);
    }

}

class StreamInterceptor extends EventEmitter {

    constructor (send) {
        super();
        this.send = send;
        this.stream = new DynamicBuffer();
        this.state = STATE_WAITING_FOR_HEADER;
    }

    push (data) {
        this.stream.push(data);
        this.process();
    }

    process () {

        switch (this.state) {

            case STATE_WAITING_FOR_HEADER:
                let headerBytes = this.stream.readBytes(USBMUXD_HEADER_LENGTH);
                if (headerBytes) {
                    this.send(headerBytes);
                    this.header = this.parseHeader(headerBytes);
                    this.state = STATE_WAITING_FOR_MESSAGE;
                    this.emit('header', this.header);
                    this.process();
                }
                break;

            case STATE_WAITING_FOR_MESSAGE:
                let messageBytes = this.stream.readBytes(this.header.length - USBMUXD_HEADER_LENGTH);
                if (messageBytes) {

                    this.send(messageBytes);
                    let message = this.parseMessage(messageBytes);

                    if (message.MessageType === 'Connect') {
                        this.state = STATE_STREAMING;
                        console.log('client started streaming');
                        this.emit('startStreaming');
                    } else {
                        this.state = STATE_WAITING_FOR_HEADER;
                    }

                    this.emit('message', message);
                    this.process();
                }
                break;

            case STATE_STREAMING:
                this.send(this.stream.readBytes(this.stream.available));
                break;

        }

    }

    parseHeader (buf) {
        return {
            length: buf.readUInt32LE(0),
            reserved: buf.readUInt32LE(4),
            type: buf.readUInt32LE(8),
            tag: buf.readUInt32LE(12)
        }
    }

    parseMessage (buf) {
        return plist.parse(buf.toString());
    }

}

class UsbmuxdInterceptor {
    
    constructor (sendToClient, sendToDaemon) {
        this.toClientStream = new StreamInterceptor(sendToClient);
        this.toDaemonStream = new StreamInterceptor(sendToDaemon);
        this.toDaemonStream.on('startStreaming', () => {
            this.toClientStream.once('message', () => {
                this.toClientStream.state = STATE_STREAMING;
                console.log('toClient started streaming');
            });
        });

        this.toClientStream.on('header', header => {
            console.log('toClient header', header);
        });
        this.toClientStream.on('message', message => {
            console.log('toClient message', message);
        });
        this.toDaemonStream.on('header', header => {
            console.log('toDaemon header', header);
        });
        this.toDaemonStream.on('message', message => {
            console.log('toDaemon message', message);
        })
    }

    interceptToClient (data) {
        this.toClientStream.push(data);
    }

    interceptToDaemon (data) {
        this.toDaemonStream.push(data);
    }

}

module.exports = UsbmuxdInterceptor;