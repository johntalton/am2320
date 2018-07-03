const { AmModbus } = require('./ammodbus.js');
const { Util } = require('./util.js');
const {
  REGISTERS,
  BULK_FIRST_REGISTER,
  BULK_DATA_BYTE_SIZE,
  INFO_FIRST_REGISTER,
  INFO_BYTE_SIZE,
  WORD_SIZE
} = require('./registers.js');

const DEFAULT_ADDRESS = 0x5C;

const AUTO_DORMANT_MSECS = 3; // todo usefulness, investigate
const MAX_READ_LENGTH = 10;

class Converter {
  static fromValue(value) { // todo, move to bit utilities
    const isNeg = ((value >> 15) & 0x1) === 0x1;
    const magnitude = value & 0x7FFF;
    if(isNeg) { return -magnitude; }
    return magnitude;
  }

  static fromTemperature(value) {
    const tempC = Converter.fromValue(value) / 10.0;
    const tempF = (tempC * (9 / 5.0)) + 32; // todo we have other sensor that use this
    return {
      C: tempC,
      F: tempF
    };
  }

  static fromHumidity(value) {
    const percentRH = value / 10.0;
    return { percent: percentRH };
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
    // todo read 32bit int .then(buffer => buffer.readUInt16BE());
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
    // const [oneL, oneH] = Util.split16();
    const oneL = one & 0xFF;
    const oneH = (one >> 8) & 0xFF;
    const twoL = two & 0xFF;
    const twoH = (two >> 8) & 0xFF;
    return this.write(REGISTERS.USER_1_HIGH, [oneH, oneL, twoH,  twoL]);
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

module.exports = { Am2320, DEFAULT_ADDRESS };
