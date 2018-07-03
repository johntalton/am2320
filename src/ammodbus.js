const crc = require('crc');
const { Util } = require('./util.js');
const {
  ErrorUtil,
  FUNCTION,
  ERROR_MASK,
  CRC_BYTE_SIZE,
  WRITE_RESPONSE_RAW_BYTE_SIZE,
  WRITE_RESPONSE_BYTE_SIZE,
  READ_RESPONSE_RAW_BYTE_SIZE_BASE,
  READ_RESPONSE_BYTE_SIZE_BASE,
  ERROR_RESPONSE_RAW_BYTE_SIZE,
  ERROR_RESPONSE_BYTE_SIZE
} = require('./ammodbusdefs.js');

// todo debug blob for now
const perf = {
  commandCount: 0,
  hasWriten: false,
  wakeMSecs: Math.INFINITY,
  lastcall: Math.INFINITY
};

/**
 *
 **/
class AmModbus {
  static wake(bus) {
    //console.log('wake');
    perf.commandCount = 0;
    perf.hasWriten = false;
    perf.wakeMSecs = Date.now();
    perf.lastcall = Math.INFINITY;

    // what is the best way to send the wake?
    // return bus.write(0x00, [])
    // return bus.read(0x00, 0)
    return bus.read(0x00, 1)
    // return bus.readBuffer(1)
      .then(() => false).catch(e => true);
  }

  static read(bus, register, length, check) {
    const command = FUNCTION.READ;
    const readsizebase = check ? READ_RESPONSE_BYTE_SIZE_BASE : READ_RESPONSE_RAW_BYTE_SIZE_BASE;
    const responsesize = readsizebase + length;

    const start = Date.now();
    if(perf.lastcall === Math.INFINITY) { console.log(' - first'); }
    console.log(' - last call delta', start - perf.lastcall);
    perf.lastcall = start;
    const delta = perf.lastcall - perf.wakeMSecs;
    console.log(' - delta from wake', delta);

    // console.log('\tread', register, length);
    //
    return bus.write(command, [register, length])
    //
    // const cmdbuf = Buffer.from([command, register, length]);
    // return bus.writeBuffer(cmdbuf)

      //.then(() => waitMSecs(2)) // todo spec notes but javascript is slow, no need :)
      .then(() => bus.readBuffer(responsesize))
      //.then(() => bus.read(command, responsesize))
      .then(buffer => {
        const end = Date.now();
        perf.lastwrite = end;

//        console.log(' - write duration', end - perf.lastcall);

        return buffer;
      })
      .then(buffer => {
        // handle modbus.read return structure
        // the resulting length should match the desired read length
        // it is of note that we have not parsed the packet at
        //   this point, but we can assume if these do not match
        //   something is wrong, and trigger error packet parsing
        const len = buffer.readUInt8(1);
        if(len !== length) {
          console.log('length vs expected', len, length, buffer);
          // parse as error
          // todo check sliced out tail to validate all Zeros
          if(!Util.validateZeroFill(buffer.slice(ERROR_RESPONSE_BYTE_SIZE))) {
            console.log(' * trailing zeros not, may not be error');
          }

          const code = Common.parseError(buffer.slice(0, ERROR_RESPONSE_BYTE_SIZE), command, check);
          throw Error(ErrorUtil.errorForCode(code));
        }

        return Common.parseResponse(buffer, command, check);
      })
      .then(buffer => {
        const len = buffer.readInt8(0);
        if((len + 1) !== buffer.length) { throw Error('length missmatch'); }
        // length is ok, slice it out and return
        return buffer.slice(1);
      });
  }

  static write(bus, register, buf, check) {
    const command = FUNCTION.WRITE;
    const length = buf.length;
    const ary = [...buf]; // todo buffer to array trick

    const data = [register, length].concat(ary);
    const checksum = crc.crc16modbus([command].concat(data));
    // todo split csum and write as lsb,msb
    const low = checksum & 0xFF;
    const high = (checksum >> 8) & 0xFF;

    const responsesize = check ? WRITE_RESPONSE_BYTE_SIZE : WRITE_RESPONSE_RAW_BTYE_SIZE;

    //console.log('write', buflen, data.concat([low, high]), csum.toString(16));

    // class tracking writen state
    if(perf.hasWriten) {
      console.log('write has been called this wake, likely falure');
    }
    perf.hasWriten = true;


    // console.log('ammodbus write', command, data, responsesize);
    //
    // console.log('this effects timing of bus.write bellow')
    // return bus.write(command, data.concat([low, high]))
    //
    const cmdbuf = Buffer.from([command].concat(data).concat([low, high]));
    return bus.writeBuffer(cmdbuf)

      // todo wait 2ms, or just let javascript be slow
      .then(() => bus.readBuffer(responsesize))
      .then(buffer => {
        // console.log('ammodbus write', data, buffer);
        // handle modbus.write return structure
        const len = buffer.readUInt8(2);
        if((len & ERROR_MASK) === ERROR_MASK) {
          if(!Util.validateZeroFill(buffer.slice(ERROR_RESPONSE_BYTE_SIZE))) {
            console.log(' * trailing zeros not, may not be error');
            console.log(buffer); // todo debug
          }

          const code = Common.parseError(buffer.slice(0, ERROR_RESPONSE_BYTE_SIZE), command, check);
          throw Error(ErrorUtil.errorForCode(code));
        }

        return Common.parseResponse(buffer, command, check);
      })
      .then(buffer => {
        const addr = buffer.readUInt8(0);
        if(addr !== register) { throw Error('register mismatch'); }

        const len = buffer.readUInt8(1);
        if(len !== length) { throw Error('write error, length missmatch'); }
      });
  }
}

class Common {
  static parseResponse(buffer, command, check) {
    // console.log('\tbuffer', buffer);
    return Common.parseCmdCrc(buffer, command, check);
  }

  static parseError(buffer, command, check) {
    if(buffer.length !== ERROR_RESPONSE_BYTE_SIZE) { throw Error('error buffer length invalid'); }
    const outbuf = Common.parseCmdCrc(buffer, command, check)
    // the out buffer should be two bytes, a base offset
    //   top level error code (loosly defined by modbus)
    // another byte which is likley propriatray to the calling
    //   structure (in the case of a write, it may be the
    //   address, or a read the length of the overall error
    //   buffer size, which is not the same concept of size
    //   shared by read in general)
    // thus inspec the code byte
    // note that the order seem backwards here. this may
    //   have to do with the intended 16bit nature of modbus
    //   and thus a 16bit read here, and then a split of
    //   the bytes may be usefull
    const code = outbuf.readUInt8(1);
    return code;
  }

  static parseCmdCrc(buffer, command, check) {
    // console.log('cmdcrc',buffer);
    const cmd = buffer.readUInt8(0);
    if(cmd !== command) { throw Error('command mismatch'); }

    if(check === false) { return buffer.slice(1); }

    // assuming buffer is correct size, crc is at the end
    const csum = buffer.readUInt16LE(buffer.length - CRC_BYTE_SIZE);

    // calculate our own crc (all data except the crc, duh)
    const data = buffer.slice(0, buffer.length - CRC_BYTE_SIZE);
    const actual = crc.crc16modbus(data);
    // console.log(csum, actual);
    if(csum !== actual) { console.log(buffer);  throw Error('crc mismatch'); }
    if(csum === 0 || actual === 0) { throw Error('crc or actuall zero'); }

    return buffer.slice(1, -CRC_BYTE_SIZE);
  }

}

module.exports = { AmModbus };
