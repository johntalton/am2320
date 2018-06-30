
const crc = require('crc');

const DEFAULT_ADDRESS = 0x5C;

const AUTO_DORMANT_MSECS = 3; // todo usefulness, investigate

const MAX_READ_LEGTH = 10;

const REGISTERS = {
  HUMIDITY_HIGH: 0x00,
  HUMIDITY_LOW: 0x01,
  TEMPERATURE_HIGH: 0x02,
  TEMPERATURE_LOW: 0x03,

  // reserved 0x04 - 0x07
  MODEL_HIGH: 0x08,
  MODEL_LOW: 0x09,
  VERSION: 0x0A,
  DEVICE_ID: 0x0B,
  // C,D and E also device id

  STATUS: 0x0F,

  USER_1_HIGH: 0x10,
  USER_1_LOW: 0x11,
  USER_2_HIGH: 0x12,
  USER_2_LOW: 0x13
};

const BULK_FIRST_REGISTER = 0x00;
const BULK_DATA_BYTE_SIZE = 4;

const INFO_FIRST_REGISTER = 0x08;
const INFO_BYTE_SIZE = 7;

const WORD_SIZE = 2;

// Modbus sutff
const FUNCTION_READ = 0x03;
const FUNCTION_WRITE = 0x10;

// mode bus format sizes
const CRC_BYTE_SIZE = 2;
const CMD_BYTE_SIZE = 1;

// write response
const WRITE_RESPONSE_HEADER_ADD_BYTE_SIZE = 1;
const WRITE_RESPONSE_HEADER_LEN_BYTE_SIZE = 1;
const WRITE_RESPONSE_HEADER_BYTE_SIZE =
  CMD_BYTE_SIZE +
  WRITE_RESPONSE_HEADER_ADD_BYTE_SIZE +
  WRITE_RESPONSE_HEADER_LEN_BYTE_SIZE;
const WRITE_RESPONSE_RAW_BYTE_SIZE = WRITE_RESPONSE_HEADER_BYTE_SIZE;
const WRITE_RESPONSE_BYTE_SIZE = WRITE_RESPONSE_RAW_BYTE_SIZE + CRC_BYTE_SIZE

// read response
const READ_RESPONSE_HEADER_LEN_BYTE_SIZE = 1;
const READ_RESPONSE_HEADER_BYTE_SIZE =
  CMD_BYTE_SIZE +
  READ_RESPONSE_HEADER_LEN_BYTE_SIZE;
const READ_RESPONSE_RAW_BYTE_SIZE_BASE = READ_RESPONSE_HEADER_BYTE_SIZE;
const READ_RESPONSE_BYTE_SIZE_BASE = READ_RESPONSE_RAW_BYTE_SIZE_BASE + CRC_BYTE_SIZE;

// error reponse
const ERROR_RESPONSE_HEADER_FOO_BYTE_SIZE = 1;
const ERROR_RESPONSE_HEADER_CODE_BYTE_SIZE = 1;
const ERROR_RESPONSE_BODY_BYTE_SIZE =
  ERROR_RESPONSE_HEADER_FOO_BYTE_SIZE +
  ERROR_RESPONSE_HEADER_CODE_BYTE_SIZE;
const ERROR_RESPONSE_HEADER_BYTE_SIZE =
  CMD_BYTE_SIZE +
  ERROR_RESPONSE_BODY_BYTE_SIZE;
const ERROR_RESPONSE_RAW_BYTE_SIZE = ERROR_RESPONSE_HEADER_BYTE_SIZE;
const ERROR_RESPONSE_BYTE_SIZE = ERROR_RESPONSE_RAW_BYTE_SIZE + CRC_BYTE_SIZE;

// error base and value map
const ERROR_BASE = 0x80;
const ERROR_MASK = 0x80;

// device specific listing of standard error values
const ERRORS = [
  // noted in datasheet
  { msg: 'NOT_SUPPORTED', key: ERROR_BASE },
  { msg: 'ILLEGAL_ADDRESS', key: ERROR_BASE + 1 }, // read length over MAX // out of range // ILLEGAL FUNCTION
  { msg: 'WRITE_DATA_SCOPE', key: ERROR_BASE + 2 }, // write over MAX // ILLEGAL DATA ADDRESS
  { msg: 'CRC_ERROR', key: ERROR_BASE + 3 }, // bad crc on wrtie // ILLEGAL DATA VALUE
  { msg: 'WRITE_DISABLED', key: ERROR_BASE + 4 }, // write 16 to 8bit register // SLAVE DEVICE FAILURE

  // from modbus datasheet
  { msg: 'SERVER DEVICE BUSY', key: ERROR_BASE + 6 } // write to ro register
];

/*function waitMSecs(msecs) {
  return new Promise((resolve, reject) => {
    console.log('wait', msecs);
    setTimeout(() => resolve(), msecs);
  });
}*/

class Converter {
  static fromValue(value) { // todo, move to bit utilities
    const isNeg = ((value >> 15) & 0x1) === 0x1;
    const magnitude = value & 0x7FFF;
    if(isNeg) { return -magnitude; }
    return magnitude;
  }

  static fromHumidity(value) {
    const percentRH = value / 10.0;
    return { percent: percentRH };
  }

  static fromTemperature(value) {
    const tempC = Converter.fromValue(value) / 10.0;
    const tempF = (tempC * (9 / 5.0)) + 32; // todo we have other sensor that use this
    return {
      C: tempC,
      F: tempF
    };
  }
}

class Util {
  static errorForCode(code) {
    const err = ERRORS.filter(item => item.key === code)
      .map(item => Error('ModBus error message: ' + item.msg))
      .find(() => true); // cheep way to safely get first item, even if not exist

    if(err) { return err; }

    return Error('unknown code: ' + '0x' + code.toString(16));
  }

  static validateZeroFill(buffer) {
    const ary = [...buffer]; // todo magic buffer to array trick
    return ary.reduce((acc, item) => acc & (item === 0), true);
  }
}

/**
 *
 **/
class Am2320 {
  static from(bus, options) {
    const opt = options !== undefined ? options : { check: true };
    return Promise.resolve(new Am2320(bus, opt));
  }

  constructor(bus, options) {
    this.bus = bus;
    this.check = options.check;

  }

  wake() { return AmModbus.wake(this.bus); }

  model() {
    return this.read(REGISTERS.MODEL_HIGH, WORD_SIZE)
      .then(buffer => buffer.readUInt16BE());
  }

  version() {
    return this.read(REGISTERS.VERSION, 1)
      .then(buffer => buffer.readUInt8());
  }

  id() {
    return this.read(REGISTERS.DEVICE_ID, 4);
    // .then(buffer => buffer.readUInt16BE());
  }

  info() {
    return this.read(INFO_FIRST_REGISTER, INFO_BYTE_SIZE)
      .then(buffer => {
        const model = buffer.readUInt16BE(0);
        const version = buffer.readUInt8(2);
        const id = buffer.readUInt32BE(3);
        return {
          model: model,
          version: version,
          id: id
        };
      });
  }

  status() {
    return this.read(REGISTERS.STATUS, 1).then(buffer => buffer.readUInt8());
  }

  setStatus(value) {
    return this.write(REGISTERS.STATUS, [value]);
  }

  user1() {
    return this.read(REGISTERS.USER_1_HIGH, WORD_SIZE).then(buffer => buffer.readUInt16BE());
  }

  setUser1(value) {
    // todo value is 16, we should split so it write properly
    return this.write(REGISTERS.USER_1_HIGH, [0, value]);
  }

  user2() {
    return this.read(REGISTERS.USER_2_HIGH, WORD_SIZE).then(buffer => buffer.readUInt16BE());
  }

  setUser2(value) {
    // todo value is 16, we should split so it write properly
    return this.write(REGISTERS.USER_2_HIGH, [0, value]);
  }

  user() {
    return this.read(REGISTERS.USER_1_HIGH, WORD_SIZE +  WORD_SIZE)
      .then(buffer => ({
        user1: buffer.readUInt16BE(0),
        user2: buffer.readUInt16BE(2)
      }));
  }

  setUser(one, two) {

  }

  humidity() {
    return this.read(REGISTERS.HUMIDITY_HIGH, WORD_SIZE).then(buffer => buffer.readUInt16BE())
      .then(value => Converter.fromHumidity(value));
  }

  temperature() {
    return this.read(REGISTERS.TEMPERATURE_HIGH, WORD_SIZE).then(buffer => buffer.readUInt16BE())
      .then(value => Converter.fromTemperature(value));
  }

  bulk() {
    return this.read(BULK_FIRST_REGISTER, BULK_DATA_BYTE_SIZE)
      .then(buffer => {
        const hum = buffer.readUInt16BE(0);
        const temp = buffer.readUInt16BE(2);
        return {
          humidity: Converter.fromHumidity(hum),
          temperature: Converter.fromTemperature(temp)
        };
      });
  }

  read(register, length) {
    return AmModbus.read(this.bus, register, length, this.check);
  }

  write(register, buffer) {
    return AmModbus.write(this.bus, register, buffer, this.check);
  }
}

const perf = {
  commandCount: 0,
  hasWriten: false,
  wakeMSecs: Math.INFINITY,
  lastcall: Math.INFINITY
};


class AmModbus {
  static wake(bus) {
    console.log('wake');

    perf.commandCount = 0;
    perf.hasWriten = false;
    perf.wakeMSecs = Date.now();
    perf.lastcall = Math.INFINITY;

    return bus.write(0x00).catch(e => console.log('wake read caught, this is normal'));
  }

  static read(bus, register, length, check) {
    const command = FUNCTION_READ;
    const readsizebase = check ? READ_RESPONSE_BYTE_SIZE_BASE : READ_RESPONSE_RAW_BYTE_SIZE_BASE;
    const responsesize = readsizebase + length;

    const start = Date.now();
    if(perf.lastcall === Math.INFINITY) { console.log(' - first'); perf.wakeMSecs = start; }
    console.log(' - last call delta', start - perf.lastcall);
    perf.lastcall = start;
    const delta = perf.lastcall - perf.wakeMSecs;
    console.log(' - delta from wake', delta);

    // console.log('\tread', register, length);
    return bus.write(command, [register, length])
      //.then(() => waitMSecs(2)) // todo spec notes but javascript is slow, no need :)
      .then(() => bus.readBuffer(responsesize))
      //.then(() => this.bus.read(command, responsesize))
      .then(buffer => {
        const end = Date.now();
        perf.lastwrite = end;

        console.log(' - write duration', end - perf.lastcall);

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
          console.log('length vs expected', len, length);
          // parse as error
          // todo check sliced out tail to validate all Zeros
          if(!Util.validateZeroFill(buffer.slice(ERROR_RESPONSE_BYTE_SIZE))) {
            console.log(' * trailing zeros not, may not be error');
          }

          const code = Common.parseError(buffer.slice(0, ERROR_RESPONSE_BYTE_SIZE), command, check);
          throw Error(Util.errorForCode(code));
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
    const command = FUNCTION_WRITE;
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

    return bus.write(command, data.concat([low, high]))
      // todo wait 2ms
      .then(() => bus.readBuffer(responsesize))
      .then(buffer => {
        // handle modbus.write return structure
        const len = buffer.readUInt8(2);
        if((len & ERROR_MASK) === ERROR_MASK) {
          if(!Util.validateZeroFill(buffer.slice(ERROR_RESPONSE_BYTE_SIZE))) {
            console.log(' * trailing zeros not, may not be error');
          }

          const code = Common.parseError(buffer, command, check);
          throw Error(Util.errorForCode(code));
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
    if(csum !== actual) { throw Error('crc mismatch'); }
    if(csum === 0 || actual === 0) { throw Error('crc or actuall zero'); }

    return buffer.slice(1, -CRC_BYTE_SIZE);
  }

}

module.exports = { Am2320, DEFAULT_ADDRESS };
