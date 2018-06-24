
const crc = require('crc');

const DEFAULT_ADDRESS = 0x5C;
const AUTO_DORMANT_MSECS = 3; // todo usefulness, investigate

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

// Modbus sutff
const FUNCTION_READ = 0x03;
const FUNCTION_WRITE = 0x10;

const ERRORS = {
  NOT_SUPPORTED: 0x80,
  ILLEGAL_ADDRESS: 0x81,
  WRITE_DATA_SCOPE: 0x82,
  CRC_ERROR: 0x83,
  WRITE_DISABLED: 0x84
};

class Converter {
  static fromValue(value) { // todo, move to bit utilities
    const isNeg = ((value >> 15) & 0x1) === 0x1;
    const magnitude = value & 0x7FFF;
    if(isNeg) { return -magnitude; }
    return magnitude;
  }

  static fromHumidity(value) {
    const percentRH = Converter.fromValue(value) / 10.0;
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

class Am2320 {
  static from(bus) {
    return Promise.resolve(new Am2320(bus));
  }

  constructor(bus) {
    this.bus = bus;
  }

  wake() {
    console.log(' ** wake');
    return this.bus.read(0x00).catch(e => console.log('wake read caught, this is normal'));
  }

  model() {
    return this.read(REGISTERS.MODEL_HIGH, 2).then(buffer => buffer.readUInt16BE());
  }

  version() {
    return this.read(REGISTERS.VERSION, 1).then(buffer => buffer.readUInt8());
  }

  id() {
    return this.read(REGISTERS.DEVICE_ID, 4);
    // .then(buffer => buffer.readUInt16BE());
  }

  status() {
    return this.read(REGISTERS.STATUS, 1).then(buffer => buffer.readUInt8());
  }

  setStatus(value) {
    return this.write(REGISTERS.STATUS, [value]);
  }

  user1() {
    return this.read(REGISTERS.USER_1_HIGH, 2).then(buffer => buffer.readUInt16BE());
  }

  setUser1(value) {
    // todo value is 16, we should split so it write properly
    return this.write(REGISTERS.USER_1_HIGH, [0, value]);
  }

  user2() {
    return this.read(REGISTERS.USER_2_HIGH, 2).then(buffer => buffer.readUInt16BE());
  }

  humidity() {
    return this.read(REGISTERS.HUMIDITY_HIGH, 2).then(buffer => buffer.readUInt16BE())
      .then(value => Converter.fromHumidity(value));
  }

  temperature() {
    return this.read(REGISTERS.TEMPERATURE_HIGH, 2).then(buffer => buffer.readUInt16BE())
      .then(value => Converter.fromTemperature(value));
  }

  bulk() {
    return this.read(0x00, 4)
      .then(buffer => {
        const hum = buffer.readUInt16BE(0);
        const temp = buffer.readUInt16BE(2);
        return {
          humidity: Converter.fromHumidity(hum),
          temperature: Converter.fromTemperature(temp)
        };
      });
  }

  read(register, length) { // todo abstract into ModBus
    const command = FUNCTION_READ;
    const readlen = length + 2 + 2; // todo const header_size / crc_size

    // console.log('\tread', register, length);
    return this.bus.write(command, [register, length])
      .then(() => this.bus.read(register, readlen))
      .then(buffer => {
        // console.log('\tbuffer', buffer);

        // header
        const cmd = buffer.readUInt8(0);
        const len = buffer.readUInt8(1);
        if(cmd !== command) { throw Error('command mismatch'); }
        if(len !== length) { throw Error('length mismatch'); }

        // read length
        const outbuf = buffer.slice(2, buffer.length - 2);

        // crc
        const csum = buffer.readUInt16LE(buffer.length - 2);

        // calculate our own crc (all data except the crc, duh)
        const data = buffer.slice(0, buffer.length - 2);
        const actual = crc.crc16modbus(data);
        if(csum !== actual) { throw Error('crc mismatch'); }

        return outbuf;
      });
  }

  write(register, buf) {
    const command = FUNCTION_WRITE;
    const buflen = buf.length;
    const ary = [...buf]; // todo buffer to array trick

    const data = [register, buflen].concat(ary);
    const checksum = crc.crc16modbus([command].concat(data));
    // todo split csum and write as lsb,msb
    const low = checksum & 0xFF;
    const high = (checksum >> 8) & 0xFF;

    const readlen = 5; // todo const header size and crc size;
    const length = buf.length;

    //console.log('write', buflen, data.concat([low, high]), csum.toString(16));

    return this.bus.write(command, data.concat([low, high]))
      .then(() => this.bus.readBuffer(readlen))
      .then(buffer => {
        console.log('buffer', buffer);

        // header
        const cmd = buffer.readUInt8(0);
        const addr = buffer.readUInt8(1);
        const len = buffer.readUInt8(2);
        if(cmd !== command) { throw Error('command mismatch'); }
        if(addr !== register) { throw Error('register mismatch'); }
        if(len !== length) { throw Error('length mismatch'); }
        console.log('read len', len);

        // read length
        const outbuf = buffer.slice(2, buffer.length - 2);

        // crc
        const csum = buffer.readUInt16LE(buffer.length - 2);

        // calculate our own crc (all data except the crc, duh)
        const data = buffer.slice(0, buffer.length - 2);
        const actual = crc.crc16modbus(data);
        if(csum !== actual) { throw Error('crc mismatch'); }

        // todo validate outbuf is the number of bytes writen
        console.log('outbuf', outbuf);

      });
  }
}

module.exports = { Am2320, DEFAULT_ADDRESS };
