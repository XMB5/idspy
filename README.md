# idspy

usbmuxd message interceptor

## What is usbmuxd?

"During normal operations, iTunes communicates with the iPhone using something called “usbmux” – this is a system for multiplexing several “connections” over one USB pipe. Conceptually, it provides a TCP-like system – processes on the host machine open up connections to specific, numbered ports on the mobile device. (This resemblance is more than superficial – on the mobile device, usbmuxd actually makes TCP connections to localhost using the port number you give it.)" https://www.theiphonewiki.com/wiki/Usbmux

## How to use

- Works on linux (and should on macos, untested)
- clone repo and `npm install`
- plug in an iOS device
- `sudo mv /var/run/usbmuxd /var/run/usbmuxx`
- `sudo node app.js`
- run a command that uses usbmuxd, such as `idevice_id -l` or `ideviceinfo`

## Adding more features

- the interesting parts are in `interceptor.js`, especially `StreamInterceptor.process()`
- usbmuxd does not transmit interesting information by itself, lockdownd does
  - lockdownd uses port 62078 over usbmuxd or the local network
  - it uses ssl, so it is not easy to reverse engineer by sniffing traffic
- take a look at [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice), they have implemented an
open source version of the usbmuxd daemon and client, and they created a lockdownd client