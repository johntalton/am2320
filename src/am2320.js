const crc = require('crc');

const DEFAULT_ADDRESS = 0x5C;
const AUTO_DORMANT_SECS = 3; // todo but min of 2s between reads? investigate

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

const FUNCTION_READ = 0x03;
const FUNCTION_WRITE = 0x10;

class Converter {
  static fromValue(value) {
    const isNeg = (value >> 15) & 0x1 === 0x1;
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
    const tempF = tempC * (9 / 5.0) + 32; // todo we have other sensor that use this
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
    console.log(' ** wake')
    return this.bus.read(0x00).catch(e => console.log('wake read caught, this is normal'));
  }

  model() {
    return this.read(REGISTERS.MODEL_HIGH, 2).then(buffer => buffer.readUInt16BE());
  }

  version() {
    return this.read(REGISTERS.VERSION, 1).then(buffer => buffer.readUInt8());
  }

  id() {
    return this.read(REGISTERS.DEVICE_ID, 4)
      //.then(buffer => buffer.readUInt16BE());
  }

  status() {
    return this.read(REGISTERS.STATUS, 1).then(buffer => buffer.readUInt8());
  }

  user1() {
    return this.read(REGISTERS.USER_1_HIGH, 2).then(buffer => buffer.readUInt16BE());
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

    //console.log('\tread', register, length);
    return this.bus.write(command, [register, length])
      .then(() => this.bus.read(register, readlen))
      .then(buffer => {
        // console.log('\tbuffer', buffer);

        // header
        const cmd = buffer.readUInt8(0);
        const len = buffer.readUInt8(1);
        if(cmd !== command) { throw Error('command missmatch'); }
        if(len !== length) { throw Error('length missmatch'); }

        // read length
        const outbuf = buffer.slice(2, buffer.length - 2);

         // crc
        const csum = buffer.readUInt16LE(buffer.length - 2);

        // calculage our own crc (all data except the crc, duh)
        const data = buffer.slice(0, buffer.length - 2);
        const actual = crc.crc16modbus(data);
        // console.log('CRC16',  csum, actual);
        if(csum !== actual) { throw Error('crc missmatch'); }

        return outbuf;
      });
  }

  write(register, value) {
    return Promise.reject(Error('not implemented'));
  }
}

module.exports = { Am2320, DEFAULT_ADDRESS };
